# Vercel Deployment Rule

When making updates to the local app code or configuration in this project, you must automatically deploy the changes to Vercel by running the `npx vercel --prod --yes` command in the `cmd.exe` shell. 
If the user hasn't explicitly asked not to deploy, always attempt to push the update to Vercel after local changes are completed and verified.

If the deployment fails with a "Not authorized" error, you must remind the user to log in to Vercel. Tell them to open their terminal (Command Prompt or PowerShell) inside the project directory (`C:\Dev\video image cutter`) and run `npx vercel login` to authenticate their account.
