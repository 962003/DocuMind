FROM node:18-bullseye-slim

WORKDIR /app

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
