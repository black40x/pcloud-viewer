#!/usr/bin/env sh
set -e
cd build
git init
git add -A
git commit -m 'deploy'
git push -f git@github.com:black40x/pcloud-viewer.git master:gh-pages
cd -
