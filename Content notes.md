

Useful SQLITE queries:


**Get info about all tables in db**

```sql
SELECT *
FROM sqlite_master 
WHERE type='table'
ORDER BY name;
```

Can chain this with `PRAGMA table_info(<table name>);` to get info about the entire schema of a DB.
