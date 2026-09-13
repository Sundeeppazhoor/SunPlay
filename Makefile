# SunPlay - Native Makefile

APP_ID = com.sunplay.native
VERSION = 1.0.0
IPK_NAME = $(APP_ID)_$(VERSION)_arm.ipk

all: package

package:
	@echo "Packaging $(APP_ID) for LG webOS..."
	@mkdir -p dist
	ares-package app -o dist

install: package
	@echo "Installing $(IPK_NAME) to TV..."
	ares-install dist/$(IPK_NAME)

launch:
	@echo "Launching $(APP_ID) on TV..."
	ares-launch $(APP_ID)

clean:
	rm -rf dist/*.ipk

.PHONY: all package install launch clean
