# with thanks to Mic92 and nicknovitski on https://github.com/NixOS/nixpkgs/pull/48848

with import <nixpkgs> {
  config = {
    allowUnfree = true;
    android_sdk.accept_license = true;
  };
};

let
   sdk = androidenv.androidPkgs_9_0.androidsdk;
in mkShell {
  LANG="en_US.UTF-8";
  ANDROID_HOME="${sdk}/libexec/android-sdk";

  nativeBuildInputs = [
    openjdk8
    sdk
    yarn
  ];
}
