oss记得续约


celery -A celery_worker.celery_app worker --loglevel=info -P solo # -P solo for Windows compatibility if needed
npm run dev
redis-server
uvicorn main:app --host localhost --port 8005 --reload



uvicorn main:app --host 0.0.0.0 --port 8100 --reload
INFO:     Will watch for changes in these directories: ['/home/zyxing/dance/examples/atlas/demos']



1 有真值的情况下，计算相似度图
2 无真值的情况下，计算相似度图
3 有真值的情况下，计算细分相似度图
4 无真值的情况下，计算csv