from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/finguard_ai")
client = AsyncIOMotorClient(MONGO_URI)
db = client.get_database()
metrics_coll = db.model_metrics

async def update_metrics(latency_ms: float, success: bool):
    metric = await metrics_coll.find_one({"_id": "current"})
    if not metric:
        metric = {
            "_id": "current",
            "predictionCount": 0,
            "successfulPredictions": 0,
            "failedPredictions": 0,
            "totalLatencyMs": 0,
            "lastPredictionAt": datetime.utcnow()
        }
    
    metric["predictionCount"] += 1
    if success:
        metric["successfulPredictions"] += 1
        metric["totalLatencyMs"] += latency_ms
    else:
        metric["failedPredictions"] += 1
    
    metric["lastPredictionAt"] = datetime.utcnow()
    
    await metrics_coll.update_one({"_id": "current"}, {"$set": metric}, upsert=True)

async def get_metrics():
    metric = await metrics_coll.find_one({"_id": "current"})
    if metric:
        avg_latency = metric["totalLatencyMs"] / metric["predictionCount"] if metric["predictionCount"] > 0 else 0
        return {
            "predictionCount": metric["predictionCount"],
            "successfulPredictions": metric["successfulPredictions"],
            "failedPredictions": metric["failedPredictions"],
            "averageLatencyMs": round(avg_latency, 2),
            "lastPredictionAt": metric["lastPredictionAt"].isoformat()
        }
    return None
