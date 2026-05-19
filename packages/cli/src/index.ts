export const CLIENT_GENERATION_REMOVED_MESSAGE =
  'Livon client generation through CLI has been removed. Configure a Livon build plugin instead.';

export interface RunLivonCli {
  (): never;
}

export const runLivonCli: RunLivonCli = () => {
  throw new Error(CLIENT_GENERATION_REMOVED_MESSAGE);
};

if (process.argv[1]?.endsWith('/livon.js')) {
  runLivonCli();
}
