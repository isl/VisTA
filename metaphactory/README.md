# metaphactory Development

## Quick Overview
The development workspace (i.e. the root folder) is divided into three main parts:

* "platform-core" folder - platform backend

  Developed in Java 8. Mainly builds upon RDF4J 2.0 (formerly known as openrdf-sesame) for processing and handling RDF data, Guice for dependency injection, Apache Shiro for security matters and Jersey for developing RESTful services.

  Maven dependencies are being managed in the file `project/dependencies.scala` and will automatically be imported and resolved by the SBT based build script.

* "platform-client-api"  - platform client

  Initial Java 8 based client to (remotely) connect to the platform. Provides dedicated interfaces for accessing assets and services such as queries. Provides some further utils ontop of RDF4J.

* "platform-web" folder - platform frontend

  Developed in Typescript and compiled to clean, simple JavaScript code which runs on any browser. Mainly using React for web-component development, SCSS for stylesheets.

  We are using NPM (will switch to JSPM soon) and Node.js for dependency management. Webpack for bundling.


We use SBT as a single entry point for compiling and bundling the sources, whereas the SBT build script calls webpack for compiling and bundling the frontend part.
 The file ```build.(sh|bat)``` located in the root directory, provides a simple wrapper around SBT in order to set some required build parameters as well as points to a dedicated maven proxy.



## Development Setup

### Development OS
While we highly recommend to use an unix-based operation system for development against the platform, it is also possible to develop on Windows systems with some specifics in the setup.

The reason why we recommend to use a unix based OS is that the NPM dependency tree can be quite extensive and nested. NPM manages these dependencies on the file system resulting in many files and nested folders. On the one hand we have experienced that this can be slow on Windows systems due to the amount of files (i.e. in particular depending on the file system and virus scanners). On the other hand Windows sometimes seems to have problems with long, interwinded path names and characters in paths.
Nevertheless, with the most recent Node and NPM version, some issues will become obsolete and there are also some workarounds such as using cygwin or mounting the development file system from a virtual machine in order to speed up the watch compilation process. These workarounds will be documented here in the near future.

### Prerequisites
As prerequisites you need to have installed on your machine:

* OpenJDK 8 (preferred, but Oracle JDK 8 is fine too)
* node.js (>= 6.x) and npm (>= 3.x)
* SBT
* yarn
* an RDF database or at least access to such (see section below)

In particular, on OSX and Unix systems the most stable versions for SBT and npm are usually available from common package managers (e.g. homebrew, apt) and as such easy to install and to upgrade.

#### RDF Database (Triplestore)

For most developments (i.e. for starting-up the platform properly) you will need to have a RDF database in place. The database does not necessarily need to run on your local machine as long as it is accessible over a standard conform SPARQL endpoint interface. For your convenience, we recommend to run, for example, Blazegraph as a container on your local docker daemon so you can easily run serveral databases in parallel and switch between them:

1. Login into Metaphacts docker registry: `docker login docker.metaphacts.com`
2. Pull latest blazegraph image: `docker pull docker.metaphacts.com/snapshot/blazegraph:2.2.0-20160908.003514-6`
3. Get ubuntu image: `docker pull ubuntu`
4. Create data (journal) container for Blazegraph container: `docker create --name blazegraph-journal -v /blazegraph-data ubuntu`
5. Run Blazegraph container with data container mounted `docker run --name blazegraph -d --restart=always -p 10080:8080 --env JAVA_OPTS="" --volumes-from blazegraph-journal docker.metaphacts.com/snapshot/blazegraph:2.2.0-20160908.003514-6`

Afterwards, **connect your development setup to the SPARQL endpoint** as exposed by the Blazegraph container running on your docker machine by adding `sparqlEndpoint=http://{yourdockerip}:10080/blazegraph/sparql` to your `/platform-core/config-dev/environment.prop` configuration file (run, for example, 'docker-machine ip' to get the IP from you docker instance).

### IDE
At metaphacts we are using various IDEs and text editors like Eclipse, Atom and Emacs.
While there exist some addons for JavaScript and Typescript in Eclipse, it is in principle possible to develop everything in only one IDE, for example, Eclipse. However, in particular for the JavaScript/Typescript development it can be convenient to use editors such as Atom or Emacs with much more powerful plugins.

### Initial Setup

#### NPM Dependencies
Simply execute `sh build.sh` or `build.bat` to get into the SBT console. While loading the build script, it will automatically invoke `npm install` within the platform-web folder to install all npm depdencies. This may take some time. It might be worth considering to setup you own private npm registry for caching purpose such as for example, [sinopia](https://github.com/rlidwka/sinopia).

#### Eclipse
If you are used to develop in Eclipse, you can automatically generate a new Eclipse project by executing the `build.sh`, which is located in the project root folder.
Once in the SBT console, execute the command `eclipse` which will first resolve all required dependencies and then will automatically generate the classpath file as well as required Eclipse metadata files. Finally, you can import the project into your Eclipse Workspace using the "Existing Projects into Workspace" wizard.


#### Known Issues
* NPM Dependencies

  Switching between major branches may require to remove and re-install the NPM dependencies.
Dependencies can easily be removed by deleting the `platform-web/node_modules` folder (i.e. `rm -r /platform-web/node_modules`). Running sbt will automatically call `npm install` to re-install the dependencies when restarting.

* GIT

 Do not clone the project from GIT using Eclipse (c.f. this [bug report](https://bugs.eclipse.org/bugs/show_bug.cgi?id=342372)).

## Running the Platform
Once being in the SBT console (`sh build.sh`), run `˜jetty:start` which will compile all sources and start the jetty server. The `~ `will make SBT to watch source directories for changes in order to trigger incremental compilation, so any change to the server-side or client-side sources triggers re-deployment, which takes no more than a few seconds until they are picked-up by Jetty.

Finally, go to [http://127.0.0.1:10214/](http://127.0.0.1:10214/). You should see the login screen and should be able to login with standard login `admin:admin`.

## Debugging
###Backend
Run `build.sh` with an additional parameter -Ddebug=true will open a remote debugging port when starting jetty with `~jetty:start`.
Once the SBT console displays the message "Listening for transport dt_socket at address: 5005" you can connect to the respective port using, for example, the remote debugging functionality in Eclipse (Run -> Debug Configurations .. -> New "Remote Java Application" -> Choose a name, "localhost" as host and "5005" as port parameter ).
###Frontend
At metaphacts we are using standard browser developer tools (or Firebug) for debugging the frontend. Furthermore, there is a dedicated plugin called "React Developer Tools" (available for Chrome, Firefox) for debugging and tracing states of react components.

There are two convenient specifies, if being in the development mode:

* Hot-Reloading

  Changes to JS/TS and CSS/LESS files are compiled and pushed during runtime. We are using so called "hot loaders" which will try to "swap" changes live into the client application i.e. without the need to reload the entire page in the browser.

* Source Attachments

  Sourcemaps are being attached ("webpack://./src") i.e. you can debug in the Typescript code instead of in the compile JS code.

## Backend Logging
The platform's backend is using log4j2 (and respective adapters) for logging and comes with four pre-configured log profiles.
The default profile is "debug", however, the profile can easily be switched by supplying the ```build.sh -Dlog={log4j2-debug,log4j2-trace,log4j2-trace2,log4j2}``` environment variable
to the sbt console. The "log4j2-trace" and "log4j2-trace2" profile produce a lot of log messages, however, can particularly be useful when one needs to trace, for example, request headers or queries without goint to debug low level APIs.
*Please note:* If an old ```log4j2.xml``` file is still present in the compilation ```/target/webapp/WEB-INF```folder, it will always be be preceded over the file set via the ```-Dlog``` env variable. Execute ```clean``` and ```clean-files``` in the sbt console to clean the target folder.

## Testing
Running `test` command in the SBT console will execute all backend tests (Java Junit) as well as client-side unit tests (using mainly mocha, chai, sinon). To just execute the client-side test, you can also run `npm test` in the `platform-web` folder. We also have a number of Gherkin (cucumber) integration tests, however, these are located in a separate repository and require a dedicated test infrastructure.

## Packaging
Run `build.sh -DBUILD_ENV=prod` and then `package`. The compiled war file will be copied to `/platform-core/target/platform-core-*.war` and can be deployed using common servlet containers such as Jetty or Tomcat.
