# Intelligence Engine Contracts

This document outlines the strict mathematical and temporal rules for the CREW Intelligence Layer. 

## 1. Monetary Values & Arithmetic
* **The API Boundary:** The frontend must send all monetary values as integer Naira. 
* **Internal Engine:** The backend immediately converts incoming Naira to Kobo (multiplying by 100) to avoid microscopic floating-point errors during calculations.
* **Percentages:** All percentages (e.g., deposit buffers, profit margins) are calculated using basis points where 100% equals 10,000 basis points.
* **Returns:** The engine executes all math in Kobo and uses integer division (`//`) to safely convert the final figures back to Naira before responding to the frontend.

## 2. Timezones and Dates
* **Anchored Time:** All date math, milestone tracking, and timeline forecasting are strictly anchored to the `Africa/Lagos` timezone.
* **Dates vs. Timestamps:** Financial event calculations (e.g., payment delays, cash gaps, "due on day 30") use calendar `date` objects rather than millisecond timestamps to prevent cross-timezone offset bugs.
* **Frontend Implementation:** The frontend must assume all dates returned by the API are evaluated in Lagos time.

## 3. Cash Flow Timeline & Risk Metrics
* **Timeline Generation:** The engine maps every project expense to a specific calendar day (`paid_on_day`). Day 0 represents the deposit inflow. The `expected_payment_day` represents the final balance inflow.
* **Cash Gap:** A cash gap occurs strictly if the running daily balance drops below `0`. The API returns `has_cash_gap` (boolean) and `cash_gap_day` (the exact day the balance goes negative).
* **Upfront Exposure:** This represents the absolute lowest point the creator's cash balance hits. It calculates the deepest hole the creator digs into the deposit or their own pocket before the final payment arrives.