FROM node:12.16.2-alpine3.9 as builder
# using multistage build reduces the size by

RUN mkdir -p /app
WORKDIR /app

COPY ./ /app
# for getting all those build deps
# https://github.com/nodejs/docker-node/issues/384#issuecomment-305208112
# RUN apk --no-cache add --virtual native-deps \
#   g++ gcc libgcc libstdc++ linux-headers make python2 && \
#   npm i --quiet node-gyp -g &&\
#   npm i --quiet && \
#   npm i -g typescript@3.1.6 @angular/cli@7 \
#       && npm i --quiet \
#       && cd app \
#       && npm i --quiet \
#       && ng build --prod \
#       && cd .. \
#       && tsc \
#       && apk del native-deps
RUN apk --no-cache add g++ gcc libgcc libstdc++ linux-headers make python2

RUN npm i --quiet node-gyp -g && \
  npm i --quiet && \
  npm i -g typescript@3.1.6 @angular/cli@7 \
      && npm i --quiet \
      && cd app \
      && npm i --quiet \
      && ng build --prod \
      && cd .. \
      && tsc
# https://github.com/nodejs/docker-node/issues/384#issuecomment-318682636
# If you are using the given snippet above, you should notice that python is
# been installed as a virtual dependency (with is a feature of alpine's APK)
# and then it's been removed right after `npm install` execution.

# So, in order to whatever command you are trying to run works it should be
# ran before the "apk del native-deps" part.

FROM node:12.16.2-alpine3.9 as runner
ARG VERSION
ARG BUILD_DATE
ARG VCS_REF
ENV NODE_ENV=production
ENV UID=991 GID=991
ENV MONGOKU_DEFAULT_HOST="localhost:27017"
ENV MONGOKU_SERVER_PORT=3100
ENV MONGOKU_DATABASE_FILE="/tmp/mongoku.db"
ENV MONGOKU_COUNT_TIMEOUT=5000
WORKDIR /app
COPY ./package*.json ./
RUN npm ci
COPY --from=builder /app/dist /app/dist
# COPY --from=builder /app/app /app/app
COPY ./docker-run.sh /app
USER node
EXPOSE 3100

LABEL description="MongoDB client for the web. Query your data directly from your browser. You can host it locally, or anywhere else, for you and your team."

ENTRYPOINT [ "node" ]
CMD ["/app/dist/server.js"]
