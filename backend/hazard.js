require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Load models
const User = require('./models/User');
const Policy = require('./models/Policy');
// Note: We aren't doing direct creation of HazardZone or LocationPing because we want to test the APIs.

const BACKEND_URL = process.env.API_URL || 'http://localhost:4000/api';

async function runSimulation() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/workshield';
  console.log('Connecting to MongoDB at:', mongoUri, '...');
  
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB. Is the docker container running?', err.message);
    process.exit(1);
  }

  try {
    console.log('\n--- 1. Fetching Admin and Setup Worker Policy in DB ---');
    
    // 1a. Login Admin via API
    console.log('Logging in Admin via API...');
    const loginRes = await axios.post(`${BACKEND_URL}/auth/login`, {
      email: 'ak1290@srmist.edu.in',
      password: 'Password@1'
    });
    const adminToken = loginRes.data.token;
    console.log(`✅ Admin logged in successfully.`);

    // 1b. Pick an existing worker from the Database
    const worker = await User.findOne({ role: 'worker', isActive: true });
    if (!worker) {
      throw new Error('No existing active worker found in the database! Please register one first.');
    }
    console.log(`✅ Picked existing worker: ${worker.email}`);

    // Manually write a policy for the worker (we delete any existing simulation-bound traffic_congestion policies for idempotency)
    await Policy.deleteMany({ userId: worker._id, 'triggers.type': 'traffic_congestion' });
    const policy = await Policy.create({
      userId: worker._id,
      coverageAmount: 1000,
      premium: 50,
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // starts yesterday
      endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // ends in 6 days
      triggers: [
        { type: 'rainfall', threshold: 50, payoutRatio: 1.0 },
        { type: 'traffic_congestion', threshold: 40, payoutRatio: 0.5 },
        { type: 'vehicle_accident', threshold: 1, payoutRatio: 1.0 }
      ],
      status: 'active'
    });
    console.log(`✅ Created Database profiles. Auto-generated worker Policy Number: ${policy.policyNumber}`);

    // Generate Auth Token manually for the worker since we don't know their plain text password
    const jwtSecret = process.env.JWT_SECRET || 'workshield-local-dev-secret';
    const workerToken = jwt.sign({ id: worker._id }, jwtSecret, { expiresIn: '1h' });

    // Ensure we can make HTTP requests
    const adminClient = axios.create({ baseURL: BACKEND_URL, headers: { Authorization: `Bearer ${adminToken}` } });
    const workerClient = axios.create({ baseURL: BACKEND_URL, headers: { Authorization: `Bearer ${workerToken}` } });

    console.log('\n--- 2. Defining the Hazard Zone via API ---');
    // Simulating a backend API call an admin makes to register a severe traffic congestion polygon
    const hazardZoneRes = await adminClient.post('/location/hazard-zones', {
      zoneId: 'sim_traffic_whitefield',
      name: 'Whitefield Main Rd Total Blockade',
      hazardType: 'FLOOD',
      isActive: true,
      boundary: {
        type: 'Polygon',
        coordinates: [[
          [77.72, 12.96], [77.74, 12.96], 
          [77.74, 12.98], [77.72, 12.98], 
          [77.72, 12.96] // Closed loop
        ]]
      }
    });
    console.log(`✅ Success: API mapped Hazard Zone -> "${hazardZoneRes.data.zone.name}"`);

    console.log('\n--- 3. Injecting Worker Telemetry (Simulating Movement) ---');
    // We simulate the worker's device pushing their live location while they are trapped in that zone
    const pings = [];
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
        // Space timestamps out by 1 minute over the last 5 minutes
      pings.push({
        timestamp: new Date(now - i * 60000).toISOString(),
        coordinates: [77.73, 12.97], // Directly inside the polygon bounding box
        accuracy: 10,
        speed: 2 // 2 m/s -> basically stuck in traffic
      });
    }
    
    const pingRes = await workerClient.post('/location/pings', { pings });
    console.log(`✅ Success: API saved worker geometry. Response: ${pingRes.data.message}`);

    console.log('\n--- 4. Firing Hazard Event & Resolving Claims ---');
    // The admin dashboard declares that "Yes, the traffic blockade has officially passed threshold length"
    console.log('Sending event broadcast to trigger automated parametric system...');
    
    // We send a window spanning the last 15 minutes to catch the pings we just pushed
    const eventRes = await adminClient.post('/location/hazard-event', {
      zoneId: 'sim_traffic_whitefield',
      triggerType: 'traffic_congestion',
      triggerValue: 45, // It crossed the policy threshold of 40 congestion limit
      timeWindow: {
        start: new Date(now - 15 * 60000).toISOString(),
        end: new Date(now + 1 * 60000).toISOString(),
      }
    });

    console.log('✅ Success: Proactive Engine completed processing.');
    console.log('\n=============================================');
    console.log('🧾 Parametric Settlement Results:');
    console.log(JSON.stringify(eventRes.data.result, null, 2));
    console.log('=============================================');

  } catch (err) {
    if (err.response) {
      console.error('❌ API Error:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('❌ Script Error:', err.message);
    }
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from DB. Simulation script complete.');
  }
}

runSimulation();