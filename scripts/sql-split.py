import re,sys,json
s=open(sys.argv[1]).read();out=[];start=0;i=0;quote=None
while i<len(s):
 if quote:
  if s.startswith(quote,i):
   if quote=="'" and s.startswith("''",i): i+=2;continue
   i+=len(quote);quote=None;continue
  i+=1;continue
 if s.startswith('--',i):
  end=s.find('\n',i);i=len(s) if end<0 else end+1;continue
 if s[i]=="'":quote="'";i+=1;continue
 if s[i]=='$':
  m=re.match(r'\$[a-zA-Z_0-9]*\$',s[i:])
  if m:quote=m.group();i+=len(quote);continue
 if s[i]==';':
  q=s[start:i].strip()
  if q and q not in ['BEGIN','COMMIT']:out.append(q)
  start=i+1
 i+=1
print(json.dumps(out))
