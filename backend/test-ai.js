
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function test() {
  const key = process.env.GEMINI_API_KEY;
  console.log('Testing Key:', key ? key.substring(0, 8) + '...' : 'MISSING');
  
  try {
    const genAI = new GoogleGenerativeAI(key);
    // Use v1 since v1beta is giving 404s
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }, { apiVersion: 'v1' });
    
    console.log('Sending test message...');
    const result = await model.generateContent("Hello, respond with ONLY the word 'SUCCESS' if you see this.");
    const response = await result.response;
    console.log('--- RESPONSE ---');
    console.log(response.text());
    console.log('----------------');
  } catch (err) {
    console.error('--- ERROR ---');
    console.error(err.message);
    if (err.message.includes('404')) {
        console.log('\nADVICE: This 404 means the "Generative Language API" is not enabled in your Google Project or your key is Vertex-only.');
    }
  }
}

test();
