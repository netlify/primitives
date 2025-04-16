for pkg in $(jq -r '.workspaces[]' package.json | sed 's/^packages///'); do
  echo $pkg
done