# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
import requests
import json

url = "http://localhost:8000/api/routes/generate"
payload = {
    "origin": {"lat": 12.9716, "lng": 77.5946},
    "destination": {"lat": 12.99, "lng": 77.61}
}

print("Sending request to generate routes...")
try:
    response = requests.post(url, json=payload, timeout=15)
    print(f"Status Code: {response.status_code}")
    print("Response JSON:")
    print(json.dumps(response.json(), indent=2)[:500])
except Exception as e:
    print(f"Error occurred: {e}")
