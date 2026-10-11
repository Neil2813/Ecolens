# Project for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza
from app.ml.ppo_router import recommend_routes
from app.db.session import SessionLocal

db = SessionLocal()
result = recommend_routes(db, {"lat": 12.9716, "lng": 77.5946}, {"lat": 12.9352, "lng": 77.6245})
print(f"Total routes: {len(result['routes'])}")
for r in result["routes"]:
    print(f"  {r['type']:15} EcoScore={r['ecoscore']:3}  PM2.5={r['pm25_exposure']:.1f}ug  CO2={r['co2_grams']:.1f}g  {r['duration_min']}min  {r['distance_km']}km")
