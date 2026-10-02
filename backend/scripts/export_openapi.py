"""python -m scripts.export_openapi  -> writes backend/openapi.generated.json (full spec incl. workspace endpoints)"""
import json
from app.main import app
open("openapi.generated.json", "w").write(json.dumps(app.openapi(), indent=2))
print("wrote openapi.generated.json")
