#!/bin/bash

if [ ! -e node_modules ]
then
  mkdir node_modules
fi

case `uname -s` in
  MINGW* | Darwin*)
    USER_UID=1000
    GROUP_UID=1000
    ;;
  *)
    if [ -z ${USER_UID:+x} ]
    then
      USER_UID=`id -u`
      GROUP_GID=`id -g`
    fi
esac

if [ -e "?/.gradle" ] && [ ! -e "?/.gradle/gradle.properties" ]
then
  echo "odeUsername=$NEXUS_ODE_USERNAME" > "?/.gradle/gradle.properties"
  echo "odePassword=$NEXUS_ODE_PASSWORD" >> "?/.gradle/gradle.properties"
  echo "sonatypeUsername=$NEXUS_SONATYPE_USERNAME" >> "?/.gradle/gradle.properties"
  echo "sonatypePassword=$NEXUS_SONATYPE_PASSWORD" >> "?/.gradle/gradle.properties"
fi


# OVERRIDES VARS
OVERRIDE_NAME="default"
for i in "$@"
do
case $i in
  -o=*|--override=*)
  OVERRIDE_NAME="${i#*=}"
  shift
  ;;
  *)
  ;;
esac
done

MOD_NAME=`grep "modname=" gradle.properties | sed 's/modname=//g'`
if [ "$OVERRIDE_NAME" = "default" ];
then
  export OVERRIDE_MODNAME="$MOD_NAME"
else
  export OVERRIDE_MODNAME="$MOD_NAME-$OVERRIDE_NAME"
fi

export OVERRIDE_BUILD="build-css"
export OVERRIDE_DIST="dist"
export OVERRIDE_SRC="overrides/$OVERRIDE_NAME"
# end of OVERRIDES VARS

clean () {
  rm -rf node_modules
  rm -rf dist
  rm -rf build
  rm -rf build-css
  rm -rf deployment/*
}

init () {
  echo "[init] Get branch name from jenkins env..."
  BRANCH_NAME=`echo $GIT_BRANCH | sed -e "s|origin/||g"`
  if [ "$BRANCH_NAME" = "" ]; then
    echo "[init] Get branch name from git..."
    BRANCH_NAME=`git branch | sed -n -e "s/^\* \(.*\)/\1/p"`
  fi
  docker-compose run -e OVERRIDE_NAME=$OVERRIDE_NAME -e OVERRIDE_MODNAME=$OVERRIDE_MODNAME -e BRANCH_NAME=$BRANCH_NAME -e FRONT_TAG=$FRONT_TAG -e NEXUS_ODE_USERNAME=$NEXUS_ODE_USERNAME -e NEXUS_ODE_PASSWORD=$NEXUS_ODE_PASSWORD --rm -u "$USER_UID:$GROUP_GID" gradle sh -c "gradle generateTemplate"
  docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "npm install"
}

initDev () {
  echo "[init] Get branch name from jenkins env..."
  BRANCH_NAME=`echo $GIT_BRANCH | sed -e "s|origin/||g"`
  if [ "$BRANCH_NAME" = "" ]; then
    echo "[init] Get branch name from git..."
    BRANCH_NAME=`git branch | sed -n -e "s/^\* \(.*\)/\1/p"`
  fi
  docker-compose run -e OVERRIDE_NAME=$OVERRIDE_NAME -e OVERRIDE_MODNAME=$OVERRIDE_MODNAME -e BRANCH_NAME=$BRANCH_NAME -e FRONT_TAG=$FRONT_TAG -e NEXUS_ODE_USERNAME=$NEXUS_ODE_USERNAME -e NEXUS_ODE_PASSWORD=$NEXUS_ODE_PASSWORD --rm -u "$USER_UID:$GROUP_GID" gradle sh -c "gradle generateTemplateDev"
  docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "npm install"
}

build () {
  local extras=$1
  #get skins
  dirs=($(ls -d ./skins/*))
  #create build dir var
  SCSS_DIR=$OVERRIDE_BUILD/scss
  SKIN_DIR=$OVERRIDE_BUILD/skins
  #create build dir and copy source
  mkdir -p $OVERRIDE_BUILD
  cp -R skins $SKIN_DIR
  cp -R scss $SCSS_DIR
  cp -R $OVERRIDE_SRC/css/* $SCSS_DIR/
  #build css
  docker-compose run -e SKIN_DIR=$SKIN_DIR -e SCSS_DIR=$SCSS_DIR -e DIST_DIR=$OVERRIDE_DIST --rm -u "$USER_UID:$GROUP_GID" node sh -c "npm run release:prepare"
  for dir in "${dirs[@]}"; do
    tmp=`echo $dir | sed 's/.\/skins\///'`
    docker-compose run -e SKIN_DIR=$SKIN_DIR -e SCSS_DIR=$SCSS_DIR -e DIST_DIR=$OVERRIDE_DIST -e SKIN=$tmp  --rm -u "$USER_UID:$GROUP_GID" node sh -c "npm run sass:build:release"
  done
  #copy override theme
  echo "Merge assets from theme...."
  cp -R node_modules/entcore-css-lib/assets/images $OVERRIDE_DIST/
  cp -R template/* $OVERRIDE_DIST/template/ 
  cp -R portal.html $OVERRIDE_DIST/
  cp -R assets/* $OVERRIDE_DIST/
  #copy override platform
  echo "Merge assets from platform...."
  cp -R $OVERRIDE_SRC/* $OVERRIDE_DIST/
  #override i18n
  echo "Merge i18n from theme and platform..."
  docker-compose run -e OVERRIDE_SRC=$OVERRIDE_SRC -e OVERRIDE_DIST=$OVERRIDE_DIST --rm -u "$USER_UID:$GROUP_GID" node sh -c "npm run override:i18n"
  echo "End merge"
  #set version
  cp node_modules/entcore-css-lib/dist/version.txt $OVERRIDE_DIST/version.txt
  VERSION=`grep "version="  gradle.properties| sed 's/version=//g'`
  echo "$OVERRIDE_MODNAME=$VERSION `date +'%d/%m/%Y %H:%M:%S'`" >> $OVERRIDE_DIST/version.txt
}

watch () {
  docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "npm run dev:watch"
}

lint () {
  docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "npm run dev:lint"
}

lint-fix () {
  docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "npm run dev:lint-fix"
}

publishNPM () {
  LOCAL_BRANCH=`echo $GIT_BRANCH | sed -e "s|origin/||g"`
  
  if [ "$OVERRIDE_NAME" != "default" ];
  then
    # rename npm package name to OVERRIDE_MODNAME in package.json
    mv package.json package.json.orig
    sed "0,/theme-open-ent/{s|theme-open-ent|$OVERRIDE_MODNAME|}" package.json.orig > package.json
  fi

  docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "npm publish --tag $LOCAL_BRANCH"

  if [ "$OVERRIDE_NAME" != "default" ];
  then
    mv package.json.orig package.json
  fi
}

publishNexus () {
  if [ -e "?/.gradle" ] && [ ! -e "?/.gradle/gradle.properties" ]
  then
    echo "odeUsername=$NEXUS_ODE_USERNAME" > "?/.gradle/gradle.properties"
    echo "odePassword=$NEXUS_ODE_PASSWORD" >> "?/.gradle/gradle.properties"
    echo "sonatypeUsername=$NEXUS_SONATYPE_USERNAME" >> "?/.gradle/gradle.properties"
    echo "sonatypePassword=$NEXUS_SONATYPE_PASSWORD" >> "?/.gradle/gradle.properties"
  fi
  docker-compose run -e OVERRIDE_NAME=$OVERRIDE_NAME -e OVERRIDE_MODNAME=$OVERRIDE_MODNAME --rm -u "$USER_UID:$GROUP_GID" gradle sh -c "gradle deploymentJar fatJar publish"
}

publishMavenLocal (){
  docker-compose run -e OVERRIDE_NAME=$OVERRIDE_NAME -e OVERRIDE_MODNAME=$OVERRIDE_MODNAME --rm -u "$USER_UID:$GROUP_GID" gradle sh -c "gradle deploymentJar fatJar publishToMavenLocal"
}

for param in "$@"
do
  echo "[$param][$OVERRIDE_NAME] Starting..."
  case $param in
    clean)
      clean
      ;;
    init)
      init
      ;;
    initDev)
      initDev
      ;;
    build)
      build
      ;;
    buildLocal)
      rm -rf build-css && build && cp -r dist/* ../recette/assets/themes/theme-open-ent
      ;;
    install)
      build && publishMavenLocal
      ;;
    watch)
      watch
      ;;
    lint)
      lint
      ;;
    lint-fix)
      lint-fix
      ;;
    publishNPM)
      publishNPM
      ;;
    publishNexus)
      publishNexus
      ;;
    *)
      echo "Invalid argument : $param"
  esac
  if [ ! $? -eq 0 ]; then
    exit 1
  fi
done