# Dev

## Prerequisites

`entcore-css-lib` must be installed and configured on the same branch.

## Install

Will install all dependencies including `entcore-css-lib` local version.


```bash
./build.sh initDev
```

## Build

Build your CSS inside `build-css` folder

```bash
./build.sh build
```

## Copy

You can copy the build CSS to your Springboard using this command:

```bash
cp build-css/skins/default/theme.css ../<SPRINGBOARD>/assets/themes/<PROJECT>/skins/default/theme.css
```

- SPRINGBOARD = the name of your springboard (eg: recette)
- PROJECT = the name of the theme used with your springboard (eg: cg77 / cg771d)

## Build and Copy

It's easier to build and copy at once:

```bash
./build.sh build && cp build-css/skins/default/theme.css ../<SPRINGBOARD>/assets/themes/<PROJECT>/skins/default/theme.css
```

## Watch

Work in progress...