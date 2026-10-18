FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
EXPOSE 8123
CMD ["npx", "@langchain/langgraph-cli", "dev", "--host", "0.0.0.0", "--port", "8123"]
