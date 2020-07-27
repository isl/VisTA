node {
    // we need to replace "/" with "-" to use it as docker tag
    def platformVersion = "ci-${env.BRANCH_NAME}-${env.BUILD_ID}".replace("/", "-");
    def documentationPluginVersion = "2.0.0-rc.${env.BRANCH_NAME}+${env.BUILD_ID}".replace("/", "-");

    // set node version for the build
    def nodeHome = tool 'node-6.2.0'
    env.PATH="${nodeHome}/bin:${env.PATH}"

    def namespace = env.JOB_NAME.tokenize('/')[1]
    def dockerFolder = "platform/researchspace/dist/docker"
    def zipInstruction = "./researchspace/dist/zip/researchspace.ini"

    stage 'build platform'

    dir('platform') {
        // get platform code from bitbucket
        checkout scm

        try {
          // build platform with sbt
          sh "./build.sh  -DnoYarn=true -DbuildEnv=prod -DzipConfig=${zipInstruction} -DplatformVersion=${platformVersion} clean test platformZip"
        } finally {
          step([$class: 'JUnitResultArchiver', testResults: 'project/webpack/tests_out/junit/**/*.xml,metaphactory/core/target/test-reports/*.xml,researchspace/core/target/test-reports/*.xml'])
          if (currentBuild.result == 'UNSTABLE')
            currentBuild.result = 'FAILURE'
        }

        // save build artifact for later usage for docker image creation
        dir('target') {
            stash name: 'platform-war', includes: "*.war"
        }

        // save log profiles
        dir('metaphactory/webapp/etc') {
            stash name: 'logs', includes: "*.xml"
        }

        // save bootstrap data and config
        dir('metaphactory/data') {
          stash name: 'data'
        }

        dir('metaphactory/data/templates') {
          stash name: 'default-templates'
        }

        dir('metaphactory/config') {
          stash name: 'config'
        }

        dir('target') {
          archive '*-*.zip'
        }
    }

    stage 'build docker images'

    dir("${dockerFolder}/platform") {
        // cbbe71da-1ee9-4bab-8469-01b92ed91875 is id of jenkins ldap user credentials
        docker.withRegistry('https://docker.metaphacts.com', 'cbbe71da-1ee9-4bab-8469-01b92ed91875') {
            unstash 'platform-war'
            // platform docker build expects file named ROOT.war
            sh 'mv platform-*.war ROOT.war'
            sh 'rm -rf etc; mkdir etc'
            dir('etc') {
              unstash 'logs'
            }

            // build platform docker image and push it to internal docker registry
            def platformDockerImage = docker.build "${namespace}/platform:${platformVersion}"
            platformDockerImage.push()
        }
    }
    dir("${dockerFolder}/data") {
        // cbbe71da-1ee9-4bab-8469-01b92ed91875 is of jenkins ldap user credentials
        docker.withRegistry('https://docker.metaphacts.com', 'cbbe71da-1ee9-4bab-8469-01b92ed91875') {
            sh 'rm -rf config; mkdir config'
            dir('config') {
              unstash 'config'
            }

            sh 'rm -rf data; mkdir data'
            dir('data') {
              unstash 'data'
            }
            // build platform-data docker image and push it to internal docker registry
            def platformDockerImage = docker.build "${namespace}/platform-data:${platformVersion}"
            platformDockerImage.push()
        }
    }

    dir("${dockerFolder}/app-default-templates") {
        // cbbe71da-1ee9-4bab-8469-01b92ed91875 is of jenkins ldap user credentials
        docker.withRegistry('https://docker.metaphacts.com', 'cbbe71da-1ee9-4bab-8469-01b92ed91875') {

            sh 'rm -rf default-templates; mkdir -p default-templates/data/templates'
            dir('default-templates/data/templates') {
              unstash 'default-templates'
            }

            writeFile file: "default-templates/plugin.properties", text: "plugin.id=metaphactory-default-templates\nplugin.provider=Metaphacts\nplugin.version=${documentationPluginVersion}\nplugin.templateMergeStrategy=overwrite\n"
            // build app-platform-default-templates docker image and push it to internal docker registry
            def platformDockerImage = docker.build "${namespace}/app-platform-default-templates:${platformVersion}"
            platformDockerImage.push()
        }
    }

    dir("platform/researchspace/app") {
        def remoteOrigin = sh(returnStdout: true, script: 'git config remote.origin.url').trim()
        println("Current origin is: ${remoteOrigin}")
        if(remoteOrigin != 'https://bitbucket.org/metaphacts/platform.git') {
          docker.withRegistry('https://docker.metaphacts.com', 'cbbe71da-1ee9-4bab-8469-01b92ed91875') {
              // build researchspace-app docker image and push it to internal docker registry
              def researchspaceDockerImage = docker.build "${namespace}/researchspace-app:${platformVersion}"
              researchspaceDockerImage.push()
          }
        }
    }

    stage 'trigger metaphacts build'

    dir('platform') {
        def remoteOrigin = sh(returnStdout: true, script: 'git config remote.origin.url').trim()
        println("Current origin is: ${remoteOrigin}")
        if(remoteOrigin == 'https://bitbucket.org/metaphacts/platform-externals.git'){
            println("Merging remote branch into current branch.")
            def metaphactsInternalOrigin = sh(returnStatus: true, script: 'git config remote.metaphacts-internal.url')

            if(metaphactsInternalOrigin == 0) {
                sh 'git remote rm metaphacts-internal'
            }

            sshagent(["79e4ac50-867b-4618-9e95-6a0b52f0f86c"]) {
                println("Setting metaphacts-internal as git remote")
                sh "git remote add metaphacts-internal git@bitbucket.org:metaphacts/platform.git"
                println("Fetch from metaphacts-internal")
                sh 'git fetch -q metaphacts-internal'
                println("Merge remote branch and push to metaphacts-internal")
                sh 'git config user.email "jenkins@metaphacts.com"'
                sh 'git config user.name "jenkins@metaphacts"'
                sh 'git merge --no-edit metaphacts-internal/metaphactory-build'
                // FORCE PUSH to internal repository
                sh "git push metaphacts-internal HEAD:refs/heads/${BRANCH_NAME} -f"
                // clean-up git user config
                sh 'git config --remove-section user'
            }
        }
    }

    // stage 'deploy'

    // dir('devops') {
    //     //we need this magic mount because of https://bugs.launchpad.net/ubuntu/+source/linux/+bug/1262287
    //     docker.image('docker.metaphacts.com/internal/ansible:master').inside('-v /var/jenkins_home:/root/.ansible/cp/') {
    //        git url: 'https://metaphacts@bitbucket.org/metaphacts/devops.git', credentialsId: 'bitbucket-metaphacts-key', branch: 'jenkins-pull-request'
    //        ansiblePlaybook credentialsId: 'jenkins-ssh-key', inventory: "ansible/playbooks/hosts", playbook: "ansible/playbooks/jenkins-pull-request.yml", extras: "--verbose -e \"deployment_name=${deploymentName} deployment_platform_version=${platformVersion} deployment_app_image=${deploymentAppImage} deployment_blazegraph_version=${deploymentBlazegraphVersion} deployment_blazegraph_context=${deploymentBlazegraphContext}\""
    //     }
    // }

    // stage 'integration tests'

    // dir('researchspace-specifications') {
    //     git url: 'https://bitbucket.org/metaphacts/specifications.git', credentialsId: 'bitbucket-metaphacts-key'
    //     sh "rm -rf node_modules && npm install"
    //     sh "./node_modules/.bin/gulp typescript"

    //     sh "mkdir -p test-results"
    //     wrap([$class: 'Xvfb', screen: '1024x768x24', displayNameOffset: 1, timeout: 0, autoDisplayName: true]) {
    //       sh "./node_modules/.bin/pioneer --configPath=pioneer-jenkins.json --tags=@iteration-1,@iteration-2,@iteration-3,@iteration-4,@annotations-assertion,@image-annotation --runConfig=./config/prod-config-jenkins.json > test-results-raw.json || true"
    //       sh "sed '1d' test-results-raw.json > ./test-results/test-results.json"
    //     }

    //     step([$class: 'CucumberReportPublisher', fileExcludePattern: '', fileIncludePattern: '', ignoreFailedTests: false, jenkinsBasePath: '', jsonReportDirectory: 'test-results', missingFails: false, parallelTesting: false, pendingFails: false, skippedFails: false, undefinedFails: false])
    // }
}
