# Use a lightweight Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy the application code
COPY . .

# Install dependencies using Aliyun mirror for speed in China
RUN pip install --no-cache-dir -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/

# Create a volume mount point for the database
# This ensures the database persists even if the container is restarted
VOLUME /data

# Set environment variables
ENV DB_PATH=/data/treehole.db
ENV HOST=0.0.0.0
ENV PORT=8000
# IMPORTANT: Override this in your deployment!
ENV ADMIN_TOKEN=change-me-in-production

# Expose the port
EXPOSE 8000

# Run the application
CMD ["python", "app.py"]
