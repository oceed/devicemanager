# Stage 1: Build React App
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html/admin
COPY --from=builder /app/portal /usr/share/nginx/html/portal
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 8081
CMD ["nginx", "-g", "daemon off;"]
