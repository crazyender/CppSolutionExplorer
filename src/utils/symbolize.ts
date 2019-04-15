import * as exec from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import * as model from '../Model/project';

export var all_global_symbols: any[] = [];


export function Symbolize(projects: model.Project[]): void {
  var cancelled = false;
  var out_dir = '';
  if (vscode.workspace.rootPath) {
    out_dir = path.join(vscode.workspace.rootPath, '.cppsolution', 'symbols');
  } else {
    return;
  }

  var total = 0;
  var current = 0;
  var all_files: {[id: string]: model.Project} = {};
  var files: string[] = [];
  for (var i = 0; i < projects.length; i++) {
    var f = projects[i].GetFiles();
    for (var j = 0; j < f.length; j++) {
      all_files[f[j]] = projects[i];
      files.push(f[j]);
      total++;
    }
  }
  console.log('Total ' + total + ' files');

  var cppsolution_dir = path.join(vscode.workspace.rootPath, '.cppsolution');
  var all_files_log = path.join(cppsolution_dir, 'all_files');
  if (!fs.existsSync(cppsolution_dir)) {
    fs.mkdirSync(cppsolution_dir);
  }

  if (fs.existsSync(all_files_log)) {
    fs.unlinkSync(all_files_log);
  }

  for (var i = 0; i < files.length; i++) {
    fs.writeFileSync(all_files_log, files[i] + '\n', {flag: 'a'});
  }


  var python_file = path.join(path.dirname(__filename), 'symbolize.py');
  var process_file_routine =
      (progress: vscode.Progress<{message?: string; increment?: number}>,
       resolve: (value?: {message?: string; increment?: number}|
                 PromiseLike<{message?: string; increment?: number}>) =>
           void) => {
        if (current >= total || cancelled) {
          resolve();
          return;
        }
        var current_file = files[current];
        var current_project = all_files[current_file];
        var args = '';
        for (var i = 0; i < current_project.GetDefines().length; i++) {
          if (process.platform !== 'win32') {
            args += ' -D' + current_project.GetDefines()[i];
          } else {
            args += ' /D ' + current_project.GetDefines()[i];
          }
        }

        for (var i = 0; i < current_project.GetIncludePathes().length; i++) {
          if (process.platform !== 'win32') {
            args += ' -I' + current_project.GetIncludePathes()[i];
          } else {
            args += ' /I "' + current_project.GetIncludePathes()[i] + '"';
          }
        }
        args += ' -std=c++11';
        var percentage = Math.round((current * 100) / total);
        // console.log('Finish ' + current + ' files, ' + percentage)
        if (percentage % 10 === 0) {
          progress.report(
              {message: percentage.toString() + '%', increment: percentage});
        }
        var cmd = 'python ' + python_file + ' ' + out_dir + ' ' + current_file +
            ' ' + args;
        var proc = exec.spawn(cmd, {shell: true});
        var std_out_string = '';
        proc.stdout.on('data', (chunk) => {
          std_out_string += chunk.toString();
        });
        proc.stderr.on('data', (chunk) => {console.log(chunk.toString())});
        proc.on('close', (code, signal) => {
          if (code !== 0) {
            console.log('Symbolize file ' + current_file + ' fail')
            console.log(cmd);
          } else {
            var objs = JSON.parse(std_out_string);
            for (var index = 0; index < objs.global.length; index++) {
              all_global_symbols.push(objs.global[index]);
            }
          }
          current++;
          process_file_routine(progress, resolve);
        });
      };

  vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: 'Parse solution',
        cancellable: true

      },
      (progress, token) => {
        var promise = new Promise(resolve => {
          progress.report({message: '', increment: 0});
          var cpus = os.cpus().length;
          for (var i = 0; i < cpus / 2; i++) {
            process_file_routine(progress, resolve);
            current++;
          }
        });

        token.onCancellationRequested(() => {
          cancelled = true;
        });
        return promise;
      });
}