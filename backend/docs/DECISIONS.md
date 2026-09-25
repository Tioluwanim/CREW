# Architecture Decisions

## 1. Flexible Cost Categories for the Creative Economy
* **Context:** The original OpenAPI contract enforced strict enums for cost categories (`materials`, `labour`, `transport`, `other`). However, the creative economy is too diverse to lock into four buckets.
* **Decision:** We removed the strict enum constraints on `CostCategory` within our domain transfer objects (DTOs).
* **Contract Update:** The `category` field in the `CostDTO` is now an unconstrained `string`. 
* **Frontend Implementation:** The frontend is free to send any string for the expense category based on the creator's specific workflow. The backend engine will accept it and process the numbers without validation errors.

## 2. Stateless Financial Engine
* **Context:** Financial calculations (profit, cash gaps) can become easily corrupted if they rely on directly querying and mutating database state during the math process.
* **Decision:** The `FinancialEngine` (Module A) is strictly stateless. It only accepts frozen `ProjectDTO` objects, performs pure deterministic math, and returns the results. 
* **Impact:** This ensures the financial logic is perfectly testable and isolated from database or ORM side-effects.

## 3. Probabilistic Statistics (Filtering Outliers)
* **Context:** A single extreme client delay (e.g., 60 days late) will drastically skew a creator's average (mean), causing the engine to generate false panic/warnings for future projects.
* **Decision:** The intelligence layer (`stats.py`) strictly uses the **median** rather than the mean to filter out extreme outliers.
* **Decision:** The engine uses **Bayesian Shrinkage** to calculate client trust. It blends a creator's historical baseline (prior) with a specific client's observed history, weighting heavily toward the baseline until the client has completed enough projects to prove they are reliable.