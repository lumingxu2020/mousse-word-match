FROM node:22-alpine
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-eng tesseract-ocr-data-chi_sim
WORKDIR /app
COPY package.json server.mjs ./
COPY dist ./dist
RUN mkdir -p /data && chown -R node:node /data /app
USER node
ENV NODE_ENV=production PORT=3093 DATA_DIR=/data
EXPOSE 3093
CMD ["node", "server.mjs"]
