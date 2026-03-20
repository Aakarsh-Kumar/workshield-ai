from flask import Flask, jsonify
from flask_cors import CORS
from routes.risk import risk_bp
from routes.fraud import fraud_bp

app = Flask(__name__)

# Allow cross-origin requests from the Next.js frontend and NGINX proxy
CORS(app)

# Register route blueprints
app.register_blueprint(risk_bp)
app.register_blueprint(fraud_bp)


@app.route('/health')
def health():
    """Health probe endpoint — used by Docker and NGINX upstream checks."""
    return jsonify({'status': 'ok', 'service': 'workshield-ai', 'version': '1.0.0'})


if __name__ == '__main__':
    # Development-only entrypoint. In production, gunicorn runs this.
    app.run(host='0.0.0.0', port=5001, debug=False)
