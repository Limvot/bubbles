# with thanks to Mic92 and nicknovitski on https://github.com/NixOS/nixpkgs/pull/48848

with import <nixpkgs> {
  config = {
    allowUnfree = true;
    android_sdk.accept_license = true;
  };
};

let
  sdk = androidenv.androidsdk {
     platformVersions = [ "28" ];
     buildToolsVersions = [ "28.0.3" ];
     abiVersions = [ "x86" "x86_64"];
     useGoogleAPIs = true;
   };
in mkShell {
  LANG="en_US.UTF-8";
  ANDROID_HOME="${sdk}/libexec";

  nativeBuildInputs = [
    openjdk8
    sdk
    yarn
  ];
}
