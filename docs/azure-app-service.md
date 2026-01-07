# Azure App Service Deployment (Node 18+)

## Prereqs

- Azure subscription
- App Service plan (Linux)
- Node.js 18+ runtime

## Quick Steps (Portal)

1. Create an App Service (Linux, Node 18+).
2. In Configuration, set:
   - `NODE_ENV=production`
3. Deploy:
   - Zip deploy the repository or
   - Use GitHub Actions (see workflow below).
4. In the App Service, set the startup command:
   - `npm run start`

## GitHub Actions (Optional)

Create a publish profile in Azure and add a repository secret:

- `AZURE_WEBAPP_PUBLISH_PROFILE`
- `AZURE_WEBAPP_NAME`

Then use the workflow in `.github/workflows/azure-app-service.yml`.

## Environment Variables

Optional Azure OpenAI vars (disabled by default):

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`

## Notes

- Build output is standard Next.js (`npm run build`).
- App Service should run `npm run start` after build.
