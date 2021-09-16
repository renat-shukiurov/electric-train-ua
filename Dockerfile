FROM node:12

ENV TZ=Europe/Kiev

RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /var/www/bot

COPY package*.json ./

RUN npm install

COPY . .

CMD [ "node", "index.js" ]