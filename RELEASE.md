# seline-js

## Release

1. `pnpm changeset` - after each change to the package, you should run this command and write a brief description of the changes
2. `pnpm changeset version` - when you decide you want to do a release, run this command. It will update the package versions based on the changes from step 1.
3. `pnpm install` - this will update the lockfile and rebuild packages
4. `git commit`
4. `pnpm run build`
5. `pnpm run publish`
