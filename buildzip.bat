set SBT_OPTS=-Djava.util.Arrays.useLegacyMergeSort=true -Dsbt.override.build.repos=true -Dsbt.repository.config=./project/repositories -DbuildEnv=prod -DzipConfig=./researchspace/dist/zip/researchspace.ini
sbt %*

rem IMPORTANT! ENSURE there are no typescript compilation errors, otherwise builtzip fails.
rem the base path to call "npm run typescript" in the new release is:  project/webpack folder
rem to build the zip RUN at CMD:  buildzip platformZip 

rem after having run 'buildzip': before trying 'build' remove folder "target" from root


rem DON'T RUN at CMD:  buildzip clean platformZip ------> this fails!!!!

rem if it fails, check the yarn version: download a stable version compatible to the nodejs
rem After building the zip remember to clean the \project\webpack\_assets folder (otherwise assets do not work on a next build)




rem -DzipConfig=./researchspace/dist/zip/researchspace.ini






rem other info
rem If you have to install an older version of a package, just specify it npm install <package>@<version> e.g. npm install typescript@2.3.4

rem npm view <package> versions e.g. npm view typescript versions