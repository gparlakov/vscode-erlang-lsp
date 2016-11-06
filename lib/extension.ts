'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as FS from 'fs';
//import * as PortFinder from 'portfinder';
import * as Net from 'net';
import * as ChildProcess from 'child_process';

import { LanguageClient, LanguageClientOptions, SettingMonitor, ServerOptions, TransportKind, StreamInfo } from 'vscode-languageclient';

export function activate(context: vscode.ExtensionContext) {

    let erlExecutablePath = findErlangExecutable('erl');

    let clientOptions: LanguageClientOptions = {
        // Register the server for erlang documents
        documentSelector: ['erlang'],
        synchronize: {
            // Synchronize the setting section 'erlang' to the server
            configurationSection: 'erlang',
            // Notify the server about relevant file changes in the workspace
            fileEvents: [
                vscode.workspace.createFileSystemWatcher('**/erlang.config.json'),
                vscode.workspace.createFileSystemWatcher('**/*.erl'),
                vscode.workspace.createFileSystemWatcher('**/*.hrl'),
                vscode.workspace.createFileSystemWatcher('**/*.yrl'),
                vscode.workspace.createFileSystemWatcher('**/*.app.src'),
                vscode.workspace.createFileSystemWatcher('**/rebar.config')
            ]
        }
    }

    function createServer(): Promise<StreamInfo> {
        return new Promise((resolve, reject) => {
            let ebin = path.resolve(context.extensionPath, "out", "ebin");
            let port = 4900;
            let args = [
                '-noshell',
                '-s', 'erlang_lsp', 'start', port.toString()
            ];

            Net.createServer(socket => {
                resolve({reader: socket, writer: socket});
            }).listen(port, () => {
                console.log('>> erl:: ' + erlExecutablePath + ' ' + args.join(' '));
                let options = { 
                    stdio: 'inherit',
                    env: {"ERL_LIBS": "_build/default/lib"}, 
                    cwd: vscode.workspace.rootPath
                };
                // Start the child java process
                let erl = ChildProcess.execFile(erlExecutablePath, args, options);
                erl.stdout.on('data', (data) => {
                    console.log("stdout: " + data);
                });
                erl.stderr.on('data', (data) => {
                    console.log("stderr: " + data);
                });
                erl.on('close', (data) => {
                    console.log("close: " + data);
                });
            });
        });
    }

    // Create the language client and start it.
    let client = new LanguageClient('Erlang Server', createServer, clientOptions);
    client.onReady().then(
            () => console.log('READY'),
            (reason) => vscode.window.showErrorMessage("Could not start Erlang language service: " + reason));
    let aclient = client.start();

    // Push the client to the context's subscriptions so that the 
    // client can be deactivated on extension deactivation
    context.subscriptions.push(aclient);
}

// this method is called when your extension is deactivated
export function deactivate() {
}

function findErlangExecutable(binname: string) {
    binname = correctBinname(binname);

    // Then search PATH parts
    if (process.env['PATH']) {
        let pathparts = process.env['PATH'].split(path.delimiter);
        for (let i = 0; i < pathparts.length; i++) {
            let binpath = path.join(pathparts[i], binname);
            if (FS.existsSync(binpath)) {
                return binpath;
            }
        }
    }

    // Else return the binary name directly (this will likely always fail downstream) 
    return binname;
}

function correctBinname(binname: string) {
    if (process.platform === 'win32')
        return binname + '.exe';
    else
        return binname;
}
