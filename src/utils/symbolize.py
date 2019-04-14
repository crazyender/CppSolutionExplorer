import clang.cindex
import sys
import os
import json
import time


result = {
    "global": [],
    "local": []
}


def GetSymbolFiles(p, f):
    if sys.platform != "win32" and len(f) > 1 and f[0] == '/':
        f = f[1:]
    elif sys.platform == "win32" and len(f) > 2 and f[1] == ':':
        f = f[2:]
    result_path = os.path.join(p, f)

    if not os.path.exists(result_path):
        os.makedirs(result_path)
    result_file = os.path.join(result_path, "symbol")
    content_hash_file = os.path.join(result_path, "content")
    return (result_file, content_hash_file)


class Translator:
    def __init__(self, parse_file, out_dir, tu):
        # type(Translator, str, Object)
        self.tu = tu
        self.scope = []
        self.scope_name = []
        self.parse_file = parse_file
        self.out_dir = out_dir

    def Run(self):
        self.__visit__(self.tu.cursor)
        json_str = json.dumps(result)
        print(json_str)
        result_file, content_hash_file = GetSymbolFiles(
            self.out_dir, self.parse_file)

        content_hash = time.strftime(
            '%Y%m%d%H%M%S%f', time.gmtime(os.path.getmtime(self.parse_file)))

        try:
            with open(content_hash_file, "w") as f:
                f.write(content_hash)
        except:
            return -1

        try:
            with open(result_file, "w") as f:
                f.write(json_str)
        except:
            return -1

        return 0

    def GetFullSymbolName(self):
        return "::".join(self.scope_name)

    def __visit__(self, node):
        # type(Translator, Object) => None
        if node.kind == clang.cindex.CursorKind.NAMESPACE:
            return self.__travel_next__(node)
        elif node.kind == clang.cindex.CursorKind.TYPEDEF_DECL:
            return self.GenerateTypeDef(node)
        elif node.kind == clang.cindex.CursorKind.ENUM_DECL:
            return self.GenerateEnum(node)
        elif node.kind == clang.cindex.CursorKind.STRUCT_DECL or node.kind == clang.cindex.CursorKind.CLASS_DECL:
            return self.GenerateClass(node)
        elif node.kind == clang.cindex.CursorKind.FIELD_DECL:
            return self.GenerateField(node)
        elif node.kind == clang.cindex.CursorKind.CXX_METHOD:
            return self.GenerateCxxMethod(node)
        elif node.kind == clang.cindex.CursorKind.CONSTRUCTOR:
            return self.GenerateConstruct(node)
        elif node.kind == clang.cindex.CursorKind.DESTRUCTOR:
            return self.GenerateDestruct(node)
        elif node.kind == clang.cindex.CursorKind.FUNCTION_DECL:
            return self.GenerateFreeFunction(node)
        else:
            return self.__travel_next__(node)

    def GenerateTypeDef(self, node):
        self.GenerateCurrent(node)

    def GenerateCurrent(self, node):
        symbol_name = self.GetFullSymbolName()
        symbol = {}
        symbol["name"] = symbol_name
        symbol["file"] = node.location.file.name
        symbol["line"] = node.location.line
        symbol["offset"] = node.location.offset
        result["global"].append(symbol)

    def GenerateEnum(self, node):
        self.GenerateCurrent(node)

        for c in node.get_children():
            name = self.GetFullSymbolName() + "::" + c.spelling
            symbol = {}
            symbol["name"] = name
            symbol["file"] = c.location.file.name
            symbol["line"] = c.location.line
            symbol["offset"] = c.location.offset
            result["global"].append(symbol)

    def GenerateClass(self, node):
        self.GenerateCurrent(node)
        self.__travel_next__(node)

    def GenerateField(self, node):
        self.GenerateCurrent(node)

    def GenerateCxxMethod(self, node):
        self.GenerateCurrent(node)

    def GenerateConstruct(self, node):
        self.GenerateCurrent(node)

    def GenerateDestruct(self, node):
        self.GenerateCurrent(node)

    def GenerateFreeFunction(self, node):
        self.GenerateCurrent(node)

    def __travel__(self, node):
        # type(Translator, Object) => None
        if node.location.file:
            translate_file = node.location.file.name
            translate_file = os.path.normpath(translate_file)
            if self.parse_file != translate_file:
                return

        self.scope.append(node)
        self.scope_name.append(node.spelling)

        self.__visit__(node)

        self.scope_name = self.scope_name[:-1]
        self.scope = self.scope[:-1]

    def __travel_next__(self, node):
        for c in node.get_children():
            self.__travel__(c)


def main(argv):
    out_dir = argv[0]
    input_file = argv[1]

    if not os.path.exists(out_dir):
        os.makedirs(out_dir)

    result_file, content_hash_file = GetSymbolFiles(
        out_dir, input_file)

    if os.path.exists(content_hash_file) and os.path.exists(result_file):
        content_hash = ""
        with open(content_hash_file) as f:
            content_hash = f.read()

        real_hash = time.strftime(
            '%Y%m%d%H%M%S%f', time.gmtime(os.path.getmtime(input_file)))

        if content_hash == real_hash:
            with open(result_file, 'r') as f:
                print(f.read())
            return 0

    extra_args = argv[2:]
    if sys.platform == "darwin":
        clang.cindex.Config.set_library_file(
            "/Library/Developer/CommandLineTools/usr/lib/libclang.dylib")
    index = clang.cindex.Index.create()
    tu = index.parse(os.path.abspath(input_file), args=extra_args)
    translator = Translator(input_file,  out_dir, tu)
    return translator.Run()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
