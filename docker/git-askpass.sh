#!/bin/sh
# Git asks twice over HTTPS: the username, then the password.
# GIT_PAT is a GitHub personal access token. It is not an SSH key.
case "$1" in
  Username*) printf '%s\n' "x-access-token" ;;
  *) printf '%s\n' "$GIT_PAT" ;;
esac
