FROM node:14

WORKDIR /telegrambot
COPY package.json .
RUN npm install
COPY . .
CMD npm start
