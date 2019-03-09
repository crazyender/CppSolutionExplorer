import * as path from "path";

export const GlobalVarients = {
    in_use_project_ : "",
    selected_config : ""
};

export function GetFileGroupNameFromFile(file: string): string {
    var ext = path.extname(file);
    switch (ext) {
      case '.c':
      case '.cc':
      case '.cxx':
      case '.cpp':
      case '.m':
      case '.mm':
        return 'Source Files';
      case '.h':
      case '.hh':
      case '.hpp':
      case '.hxx':
        return 'Header Files';
      case '.java':
        return 'Java Files';
      default:
        return 'Object Files';
    }
  }