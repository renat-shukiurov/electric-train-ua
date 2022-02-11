#!/usr/bin/env bash

# dev | lint | lint_check | watch | install | webpack | webpack_dev | grunt
env=$1;

LOCAL_PATH=$(pwd);
OS=`uname -s`

#if [[ ${OS} = "Darwin" ]]; then # mac os
#  LOCAL_PATH="backend_app"
#fi

if [[ "$env" = "docker" ]]
then
    echo "ENV: docker build";
    docker build -t tg-bot .

elif [[ "$env" = "watch" ]]
then
    echo "ENV: watch";
    docker run --rm --name="tg-bot-node" -it tg-bot sh -c "npm run dev";

elif [[ "$env" = "install" ]]
then
    echo "ENV: install";
    docker run --rm --name="tg-bot-node" -it tg-bot sh -c "npm install";

else
    echo "ENV: prod";
    docker run -d --restart unless-stopped --name="tg-bot-node" tg-bot sh -c "npm run start";
fi
