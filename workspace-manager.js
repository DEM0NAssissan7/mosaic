var workspaces = [];
var overrides = [];

function create_override(workspace, victim_descriptor, replacement_descriptor) {
    let workspace_index = workspace.index();
    if(!workspaces[workspace_index])
        workspaces[workspace_index] = [];
    workspaces[workspace_index][victim_descriptor.index] = replacement_descriptor;
    workspaces[workspace_index][replacement_descriptor.index] = victim_descriptor;
}

function remove_workspace(index) {
    workspaces.splice(index, 1);
}

function append_workspace(index) {
    workspaces.splice(index, 0, []);
}