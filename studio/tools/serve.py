from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from functools import partial
import re
import argparse
import webbrowser
ROOT=Path(__file__).resolve().parents[2]
class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        self.remaining=None
        p=Path(self.translate_path(self.path))
        if '.git' in p.parts:
            self.send_error(404);return None
        requested=self.headers.get('Range','')
        if p.is_file() and requested:
            m=re.fullmatch(r'bytes=(\d*)-(\d*)',requested);size=p.stat().st_size
            if m and size:
                a,b=m.groups();start=int(a) if a else max(0,size-int(b or 0));end=min(size-1,int(b)) if a and b else size-1
                if not 0<=start<=end<size:self.send_error(416);return None
                f=p.open('rb');f.seek(start);self.remaining=end-start+1
                self.send_response(206);self.send_header('Content-Type',self.guess_type(str(p)));self.send_header('Content-Length',str(self.remaining));self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.send_header('Accept-Ranges','bytes');self.end_headers();return f
        return super().send_head()
    def copyfile(self,source,out):
        try:
            if self.remaining is None:return super().copyfile(source,out)
            while self.remaining:
                b=source.read(min(self.remaining,1024*1024))
                if not b:break
                out.write(b);self.remaining-=len(b)
        except (BrokenPipeError,ConnectionResetError):pass
    def end_headers(self):
        self.send_header('Cache-Control','no-cache');super().end_headers()
    def log_message(self,*args):pass
if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Preview the Moment90 studio with video seeking support.')
    parser.add_argument('--port',type=int,default=8877,help='Local port; use 0 for an available port.')
    parser.add_argument('--open',action='store_true',help='Open the local studio in your browser.')
    args=parser.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),partial(Handler,directory=str(ROOT)))
    url=f'http://127.0.0.1:{server.server_port}/studio/'
    print(url,flush=True)
    if args.open:webbrowser.open(url)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
