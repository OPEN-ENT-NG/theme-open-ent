#!/bin/bash

MVN_MOD_GROUPID=`grep 'modowner=' gradle.properties | sed 's/modowner=//'`
MVN_MOD_NAME=`grep 'modname=' gradle.properties | sed 's/modname=//'`
MVN_MOD_VERSION=`grep 'version=' gradle.properties | sed 's/version=//'`

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
ITEMS=(default monlycee hdf paris moncollege na cg77 leo);
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

MOD_NAME=`grep "modname=" gradle.properties | sed 's/modname=//g' | sed 's/\r$//'`
if [ "$OVERRIDE_NAME" = "default" ];
then
  export FINAL_MODNAME="$MOD_NAME"
else
  export FINAL_MODNAME="$MOD_NAME-$OVERRIDE_NAME"
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
  rm -f yarn.lock
  rm -f pnpm-lock.yaml
  rm -rf .pnpm-store
  rm -f package.json
  rm -f LICENSE
  rm -rf deployment/*
}

doInit () {
  echo "[init$1][$OVERRIDE_NAME] Get branch name from jenkins env..."
  BRANCH_NAME=`echo $GIT_BRANCH | sed -e "s|origin/||g"`
  if [ "$BRANCH_NAME" = "" ]; then
    echo "[init$1][$OVERRIDE_NAME] Get branch name from git..."
    BRANCH_NAME=`git branch | sed -n -e "s/^\* \(.*\)/\1/p"`
  fi
  
  echo "[init$1][$OVERRIDE_NAME] Generate deployment file from conf.deployment..."
  mkdir -p deployment/$FINAL_MODNAME
  cp conf.deployment deployment/$FINAL_MODNAME/conf.json.template
  sed -i "s/%MODNAME%/${FINAL_MODNAME}/" deployment/$FINAL_MODNAME/conf.json.template
  sed -i "s/%VERSION%/${MVN_MOD_VERSION}/" deployment/$FINAL_MODNAME/conf.json.template
  
  echo "[init$1][$OVERRIDE_NAME] Generate package.json from package.json.template..."
  NPM_VERSION_SUFFIX=`date +"%Y%m%d%H%M"`
  cp package.json.template package.json
  sed -i "s/%generateVersion%/${NPM_VERSION_SUFFIX}/" package.json
  
  if [ "$1" == "Dev" ]
  then
    sed -i "s/npm:ode-csslib@%entcoreCSSVersion%/link:..\/entcore-css-lib\//" package.json
  else
    sed -i "s/%entcoreCSSVersion%/${BRANCH_NAME}/" package.json
  fi

  if [[ ${ITEMS[@]} =~ "$OVERRIDE_NAME" ]];
  then
    sed -i "s/%license%/AGPL-3.0/" package.json
    echo "[init$1][$OVERRIDE_NAME] Generate README file..."
    cp README.md.template README.md
    echo "[init$1][$OVERRIDE_NAME] Generate LICENSE file..."
    cp LICENSE.template LICENSE
  else
    sed -i "s/%license%/NONE/" package.json
      rm -f README.md
      rm -f LICENSE
    break
  fi

  echo "[init$1][$OVERRIDE_NAME] Install pnpm dependencies..."
  docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "pnpm install"
}

init() {
  doInit
}

initDev () {
  doInit "Dev"
}

build () {
  rm -rf build-css/
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
  docker-compose run -e SKIN_DIR=$SKIN_DIR -e SCSS_DIR=$SCSS_DIR -e DIST_DIR=$OVERRIDE_DIST --rm -u "$USER_UID:$GROUP_GID" node sh -c "pnpm run release:prepare"
  status=$?
  if [ $status != 0 ];
  then
    exit $status
  fi

  for dir in "${dirs[@]}"; do
    tmp=`echo $dir | sed 's/.\/skins\///'`
    docker-compose run -e SKIN_DIR=$SKIN_DIR -e SCSS_DIR=$SCSS_DIR -e DIST_DIR=$OVERRIDE_DIST -e SKIN=$tmp  --rm -u "$USER_UID:$GROUP_GID" node sh -c "pnpm run sass:build:release"
    status=$?
    if [ $status != 0 ];
    then
      exit $status
    fi
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
  docker-compose run -e OVERRIDE_SRC=$OVERRIDE_SRC -e OVERRIDE_DIST=$OVERRIDE_DIST --rm -u "$USER_UID:$GROUP_GID" node sh -c "pnpm run override:i18n"
  status=$?
  if [ $status != 0 ];
  then
    exit $status
  fi
  echo "End merge"
  #set version
  cp node_modules/entcore-css-lib/dist/version.txt $OVERRIDE_DIST/version.txt
  VERSION=`grep "version="  gradle.properties| sed 's/version=//g'`
  echo "$FINAL_MODNAME=$VERSION `date +'%d/%m/%Y %H:%M:%S'`" >> $OVERRIDE_DIST/version.txt
}

watch () {
  docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "pnpm run dev:watch"
}

lint () {
  docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "pnpm run dev:lint"
}

lint-fix () {
  docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "pnpm run dev:lint-fix"
}

publishNPM () {
  LOCAL_BRANCH=`echo $GIT_BRANCH | sed -e "s|origin/||g"`
  
  if [ "$OVERRIDE_NAME" != "default" ];
  then
    # rename npm package name to FINAL_MODNAME in package.json
    sed -i "0,/ode-csslib-openent/{s|ode-csslib-openent|$FINAL_MODNAME|}" package.json
  fi

  docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "pnpm publish --no-git-checks --tag $LOCAL_BRANCH"
  status=$?
  if [ $status != 0 ];
  then
    exit $status
  fi
}

archive() {
  echo "[archive][$OVERRIDE_NAME] Archiving dist folder and conf.j2 file..."
  tar cfzh ${FINAL_MODNAME}.tar.gz dist/* conf.j2
}

publishNexus () {
  case "$MVN_MOD_VERSION" in
    *SNAPSHOT) nexusRepository='snapshots' ;;
    *)         nexusRepository='releases' ;;
  esac
  mvn deploy:deploy-file --batch-mode -DgroupId=$MVN_MOD_GROUPID -DartifactId=$FINAL_MODNAME -Dversion=$MVN_MOD_VERSION -Dpackaging=tar.gz -Dfile=${FINAL_MODNAME}.tar.gz -DrepositoryId=wse -Durl=https://maven.opendigitaleducation.com/nexus/content/repositories/$nexusRepository/
}

publishMavenLocal (){
  mvn install:install-file --batch-mode -DgroupId=$MVN_MOD_GROUPID -DartifactId=$FINAL_MODNAME -Dversion=$MVN_MOD_VERSION -Dpackaging=tar.gz -Dfile=${FINAL_MODNAME}.tar.gz
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
      build && archive && publishMavenLocal
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
    archive)
      archive
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