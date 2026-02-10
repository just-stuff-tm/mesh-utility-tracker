# CSV Data Format Reference

## Overview

The mesh-data repository stores scans in **CSV format** (plus JSON) to enable easy filtering and searching directly in GitHub.

## CSV Column Reference

| Column | Type | Description | Example | Notes |
|--------|------|-------------|---------|-------|
| `radioId` | String | Scanner's Meshtastic node ID | `!abcd1234` | 9 characters, starts with `!` |
| `timestamp` | Integer | Unix timestamp in milliseconds | `1705334400000` | UTC timezone |
| `datetime_utc` | String | ISO 8601 timestamp | `2024-01-15T10:00:00.000Z` | Human-readable |
| `latitude` | Float | Latitude in decimal degrees | `37.774900` | 6 decimal places |
| `longitude` | Float | Longitude in decimal degrees | `-122.419400` | 6 decimal places |
| `altitude` | Float | Altitude in meters | `50.0` | Optional, 1 decimal place |
| `nodeId` | String | Detected node's ID | `!def45678` | 9 characters |
| `rssi` | Integer | Signal strength in dBm | `-85` | Range: -120 to -30 |
| `snr` | Float | Signal-to-noise ratio in dB | `8.5` | Optional |
| `hopLimit` | Integer | Remaining mesh hops | `3` or `0` | **Empty = zero-hop scan** |

## Example CSV Data

```csv
radioId,timestamp,datetime_utc,latitude,longitude,altitude,nodeId,rssi,snr,hopLimit
!abcd1234,1705334400000,2024-01-15T10:00:00.000Z,37.774900,-122.419400,50.0,!def45678,-85,8.5,
!abcd1234,1705334460000,2024-01-15T10:01:00.000Z,37.775000,-122.419300,51.0,!ghi91011,-92,5.2,0
!xyz98765,1705334520000,2024-01-15T10:02:00.000Z,37.780000,-122.420000,45.5,!def45678,-78,12.3,3
```

## Zero-Hop Scans

**What is a zero-hop scan?**
- Direct Bluetooth connection (no mesh routing)
- Node is within direct radio range
- `hopLimit` field is **empty** or `0`

**Why zero-hop?**
- Most reliable signal measurements
- Indicates proximity to node
- No multi-hop degradation

**Example:**
```csv
!abcd1234,1705334400000,2024-01-15T10:00:00.000Z,37.774900,-122.419400,50.0,!def45678,-65,15.2,
```
The empty `hopLimit` means this is a zero-hop (direct) scan.

## Filtering Examples

### Command Line (grep/awk)

**Find zero-hop scans:**
```bash
# Empty hopLimit (column 10)
awk -F',' '$10 == ""' scans/**/*.csv

# Or explicit 0
grep ",0$" scans/**/*.csv
```

**Find strong signals (RSSI > -70):**
```bash
awk -F',' '$8 > -70' scans/**/*.csv
```

**Find scans from specific radio:**
```bash
grep "^!abcd1234," scans/**/*.csv
```

**Find scans in geographic area:**
```bash
# San Francisco (lat 37.7-37.8, lon -122.5 to -122.4)
awk -F',' '$4 >= 37.7 && $4 <= 37.8 && $5 >= -122.5 && $5 <= -122.4' scans/**/*.csv
```

### Python (pandas)

```python
import pandas as pd

# Load CSV
df = pd.read_csv('scans/2024-01-15/batch-1705334400000.csv')

# Zero-hop scans (empty or 0)
zero_hop = df[df['hopLimit'].fillna('') == '']
# Or: zero_hop = df[df['hopLimit'].fillna(0) == 0]

# Strong signals
strong = df[df['rssi'] > -70]

# Specific radio
my_radio = df[df['radioId'] == '!abcd1234']

# Geographic filter
sf_area = df[
    (df['latitude'] >= 37.7) & (df['latitude'] <= 37.8) &
    (df['longitude'] >= -122.5) & (df['longitude'] <= -122.4)
]

# Count scans per node
node_counts = df.groupby('nodeId').size()

# Average RSSI per node
node_rssi = df.groupby('nodeId')['rssi'].mean()
```

### SQL (DuckDB)

```sql
-- Load all CSVs
CREATE TABLE scans AS 
SELECT * FROM read_csv_auto('scans/**/*.csv');

-- Zero-hop scans
SELECT * FROM scans 
WHERE hopLimit IS NULL OR hopLimit = 0;

-- Best coverage per node
SELECT 
  nodeId, 
  COUNT(*) as scan_count,
  AVG(rssi) as avg_rssi,
  MAX(rssi) as best_rssi
FROM scans
GROUP BY nodeId
ORDER BY avg_rssi DESC;

-- Scans by hour
SELECT 
  EXTRACT(hour FROM CAST(datetime_utc AS TIMESTAMP)) as hour,
  COUNT(*) as scans
FROM scans
GROUP BY hour
ORDER BY hour;
```

### GitHub Web Interface

1. Navigate to `scans/YYYY-MM-DD/`
2. Click any `.csv` file
3. GitHub renders it as a table
4. Use the search box to filter
5. Click headers to sort

**GitHub Search Syntax:**
```
!abcd1234 path:scans/ language:CSV
```

## Data Quality Notes

### Missing Values

- **Altitude:** Often empty if GPS doesn't have altitude fix
- **SNR:** May be empty for some hardware models
- **HopLimit:** Empty indicates zero-hop (direct) scan

### Signal Strength Ranges

- **Excellent:** RSSI > -60 dBm
- **Good:** RSSI -60 to -80 dBm
- **Fair:** RSSI -80 to -90 dBm
- **Poor:** RSSI < -90 dBm

### Duplicate Scans

Multiple scans of the same node from same location are expected:
- Mesh nodes broadcast periodically
- Scanner records each received packet
- Use `timestamp` to deduplicate if needed

## Integration Examples

### Export to GeoJSON

```python
import pandas as pd
import json

df = pd.read_csv('scans/2024-01-15/batch-1705334400000.csv')

features = []
for _, row in df.iterrows():
    feature = {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [row['longitude'], row['latitude']]
        },
        "properties": {
            "radioId": row['radioId'],
            "nodeId": row['nodeId'],
            "rssi": row['rssi'],
            "snr": row['snr'],
            "timestamp": row['datetime_utc']
        }
    }
    features.append(feature)

geojson = {
    "type": "FeatureCollection",
    "features": features
}

with open('scans.geojson', 'w') as f:
    json.dump(geojson, f)
```

### Import to PostgreSQL

```sql
CREATE TABLE mesh_scans (
  radio_id VARCHAR(10),
  timestamp BIGINT,
  datetime_utc TIMESTAMP,
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  altitude DECIMAL(6,1),
  node_id VARCHAR(10),
  rssi INTEGER,
  snr DECIMAL(5,2),
  hop_limit INTEGER
);

COPY mesh_scans FROM 'batch-1705334400000.csv' 
WITH (FORMAT csv, HEADER true);

CREATE INDEX idx_radio_id ON mesh_scans(radio_id);
CREATE INDEX idx_node_id ON mesh_scans(node_id);
CREATE INDEX idx_datetime ON mesh_scans(datetime_utc);
```

### Generate Heatmap

```python
import pandas as pd
import folium
from folium.plugins import HeatMap

df = pd.read_csv('scans/2024-01-15/batch-1705334400000.csv')

# Convert RSSI to heat value (0-1 scale)
df['heat'] = (df['rssi'] + 120) / 90  # Normalize -120 to -30 → 0 to 1

# Create map
m = folium.Map(location=[df['latitude'].mean(), df['longitude'].mean()], zoom_start=12)

# Add heatmap
heat_data = df[['latitude', 'longitude', 'heat']].values.tolist()
HeatMap(heat_data).add_to(m)

m.save('coverage-heatmap.html')
```

## Performance Tips

### Large Files

For files > 100 MB:
```bash
# Stream processing
awk -F',' '$8 > -70' large-file.csv | head -1000

# Parallel processing
parallel --pipe --block 10M awk -F',' \'$8 > -70\' ::: large-file.csv
```

### Multiple Files

```bash
# Combine all CSVs (keep header once)
awk 'FNR==1 && NR!=1{next;}{print}' scans/**/*.csv > all-scans.csv

# Or with headers from first file only
head -1 scans/2024-01-15/batch-*.csv | head -1 > all-scans.csv
tail -n +2 -q scans/**/*.csv >> all-scans.csv
```

## See Also

- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture
- [DATA_REPO_README.md](../DATA_REPO_README.md) - Data repository README template
- [worker/README.md](../worker/README.md) - Worker API documentation
