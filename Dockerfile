# ----------------------------
# 👷 Development stage
# ----------------------------
FROM node:20-alpine AS development

WORKDIR /app

# Install all dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy the full source
COPY . .

# Build the app (generates /dist)
RUN yarn build


# ----------------------------
# 🚀 Production stage
# ----------------------------
FROM node:20-alpine AS production

WORKDIR /app

# Only install production dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

# Copy only necessary files from build
COPY --from=development /app/dist ./dist
COPY --from=development /app/.env .env
COPY --from=development /app/node_modules ./node_modules
COPY --from=development /app/node_modules/.prisma /app/node_modules/.prisma

# Match the internal port used by NestJS (typically 3000 unless you override it)
EXPOSE 3000

# Start the app
CMD ["node", "dist/src/main"]