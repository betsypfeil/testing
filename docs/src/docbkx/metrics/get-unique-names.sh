#!/bin/bash
cat generated-remote.*|grep "^    \""|sed 's/[ ":{]*//g'|sort|uniq
