# Use the official Node.js image as the base image
FROM node:20

# Google Chrome Repository for Selenium
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'

RUN apt update && \
    apt install --no-install-recommends -y build-essential gcc && \
    apt clean && rm -rf /var/lib/apt/lists/*

# Setup Chrome Driver
RUN apt -y update
RUN apt install -y google-chrome-stable

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install the project dependencies
RUN npm install

# Install the project playwright version
RUN npx playwright install

# Copy the rest of the application code to the container
COPY . .

# Expose the port on which your NestJS application will run
EXPOSE 4000

# Start the application
CMD ["npm", "run", "start"]