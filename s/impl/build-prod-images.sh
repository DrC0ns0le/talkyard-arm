#!/bin/bash

# Abort on any error
set -e

my_username="$1"
version_tag="$2"
shift
shift

if [ -z "$version_tag" ]; then
  echo "No version_tag parameter. Usage:  $0 your-username version-tag"
  echo "Bye."
  exit 1
fi

# Docker-compose will mount $HOME/.ivy2 and $HOME/.m2, and we want to mount
# $my_username's Ivy and Maven cache dirs, so change $HOME from /root/ to:
export HOME=/home/$my_username

echo "
Building: $version_tag
With username: $my_username
And HOME: $HOME
Other args: $@
"


# This'll make us call `exit 1` if there's an error, and we're running all this via a script.
is_in_script=true

# Won't exit if we're doing stuff manually on the command line (because it's annoying
# if the terminal suddenly disappears).
function die_if_in_script {
  if [ -n "$is_in_script" ]; then
    echo "Bye."
    exit 1
  fi
}


# Options?
# ----------------------

all_orig_options="$@"

skip_e2e_tests=''
skip_build=''

for arg in "$@"; do
  case $arg in
    #-x=*|--something=*)
    #STH="${i#*=}"
    #hift # past argument=value
    #;
    --skip-e2e-tests)
    echo "Will skip E2E tests, because of --skip-e2e-tests."
    echo
    skip_e2e_tests=yes
    shift
    ;;
    --skip-build)
    echo "Will skip build, because of --skip-build."
    echo
    skip_build=yes
    shift
    ;;
    *)
    # Unknown option, ignore. Maybe it's for wdio.conf?
    ;;
  esac
done


# Ensure no other containers running
# ----------------------

# Dupl kill-down prod test code. [KLLPRDTST]  [prod_test_docker_conf]
test_containers='docker-compose -p edt -f modules/ed-prod-one-test/docker-compose.yml -f modules/ed-prod-one-test/debug.yml -f modules/ed-prod-one-test-override.yml -f docker-compose-no-limits.yml'
$test_containers kill web app search cache rdb
$test_containers down

s/d kill web app
s/d down

# Any unexpected containers up and running might cause problems.

function containers_running_test() {
  # 'tail -n +2' skips the column titles row. We exclude any '*registry*' container,
  # because it's fine to run a local Docker registry, if testing images on localhost.
  # And we exclude any container started via s/selenium ('tye2ebrowser')
  # or that runs the e2e Bash scripts ('tynodejs').
  docker ps | tail -n +2 | grep -v registry | grep -v tye2ebrowser | grep -v tynodejs
}

if [ false ]; then
  echo
  echo "Docker containers are running, PLEASE STOP THEM, thanks. Look:"
  echo
  docker ps
  echo
  die_if_in_script
fi


# Build Docker images
# ----------------------

if [ -z "$skip_build" ]; then
  # Build to-talkyard, needed in e2e tests.
  pushd .
  cd to-talkyard
  yarn build
  popd

  # Build minified script bundles; will be included in the web and app images. [PRODBNDLS]
  s/d-gulp clean
  s/d-gulp build_release_dont_clean_before

  # Build images (except for the app server prod image). This will Dockerfile COPY
  # js and css generated by 'gulp build_...' above.
  s/d build

  # Build the app server prod image.
  # First run tests though. All this needs lots of memory.
  PLAY_HEAP_MEMORY_MB=7168 IS_PROD_TEST=true s/d-cli clean compile
  PLAY_HEAP_MEMORY_MB=7168 IS_PROD_TEST=true s/d-cli test dist
  s/d kill web app
  s/d down
  # This will use the prod package built with 'dist' above.
  s/impl/build-prod-app-image.sh
fi


# Run End-to-End tests
# ----------------------

if [ -z "$skip_e2e_tests" ]; then

  # If there's a development Docker network, there'll be an IP address space clash
  # when creating a prodution test network later below. Delete any dev network.
  set +e
  docker network rm tyd_internal_net
  set -e

  # Run the 'latest' tag — it's for the images we just built above.
  # '-p edt' = EffectiveDiscussions Test project.
  # Use the -no-limits.yml file, because we'll run performance tests.
  export VERSION_TAG=latest
  export POSTGRES_PASSWORD=public
  export DOCKER_REPOSITORY=debiki
  $test_containers down
  rm -fr modules/ed-prod-one-test/data
  $test_containers up -d

  if [ -n "`jobs`" ]; then
    echo 'Other jobs running:'
    jobs
    echo 'Please stop them.'
    die_if_in_script
  fi


  exit_code_file='./target/e2e-tests-exit-code'
  rm -f $exit_code_file

  # Run Webdrier.io e2e tests, but not as root.
  # To stop these e2e tests, you need to 'sudo -i' in another shell, then 'ps aux | grep e2e'
  # and then kill the right stuff.
  echo "Running E2E tests ..."
  su $my_username -c "s/run-e2e-tests.sh --is-root --prod $all_orig_options ; echo \$? > $exit_code_file"

  e2e_tests_exit_code=$(cat $exit_code_file)

  if [ "$e2e_tests_exit_code" != '0' ]; then
    echo
    echo "E2E tests failed. Aborting build."
    echo
    echo "(You can test run the failed test now — Talkyard server still running.)"
    echo
    die_if_in_script
  fi

  $test_containers kill web app
  $test_containers down
fi


# # Test performance
# # -----------------
# 
# # (The perf test repo is currenty private)
# 
# pushd .
# cd ../ed-perf-test/
# ./test-performance.sh
# perf_test_result=$?
# 
# popd
# 
# if [ $perf_test_result -ne 0 ]; then
#   die_if_in_script
# fi



# # Test rate & bandwidth limits
# # ----------------------
# 
# # Start the containers, but *with* rate limits this time.
# sudo $test_containers kill web
# sudo $test_containers down
# 
# # Run tests ... ensure gets 503 Service Unavailable ...
# # To do ...



# All done
# ----------------------

# If any Docker container is running now, something is amiss.
if [ -n "`containers_running_test`" ]; then
  echo
  echo "Some Docker stuff is still running. Why? Weird. Aborting. Look:"
  echo
  docker ps
  echo
  die_if_in_script
fi

echo
echo "Done building and testing $version_tag."
echo "BUILD_OK" | tee ./target/build-exit-status


# vim: et ts=2 sw=2 tw=0 list
