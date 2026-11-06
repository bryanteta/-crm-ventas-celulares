#!/usr/bin/env python3
"""Create the public update manifest from the signed APK; never include credentials."""
import argparse, hashlib, json, pathlib, re, subprocess
p=argparse.ArgumentParser();p.add_argument('apk',type=pathlib.Path);p.add_argument('--apksigner',default='apksigner');p.add_argument('--distribution-branch',action='store_true');p.add_argument('--aapt',default='aapt');p.add_argument('--tag',required=True);p.add_argument('--out',type=pathlib.Path,required=True);a=p.parse_args()
badging=subprocess.check_output([a.aapt,'dump','badging',str(a.apk)],text=True)
m=re.search(r"package: name='com.crmcelulares.app' versionCode='(\d+)' versionName='(\d+\.\d+\.\d+)'",badging)
if not m or a.tag!='v'+m[2]:raise SystemExit('APK package/tag/version mismatch')
cert=subprocess.check_output([a.apksigner,'verify','--print-certs',str(a.apk)],text=True)
if '49be17458fe0ba6989d8523faa39ccb937b1576ded93a80de193dc59d44dd9f6' not in cert:raise SystemExit('APK signing identity differs from installed Lunivo')
data={'versionCode':int(m[1]),'versionName':m[2],'apkUrl':f'https://github.com/bryanteta/-crm-ventas-celulares/releases/download/{a.tag}/{a.apk.name}','sha256':hashlib.sha256(a.apk.read_bytes()).hexdigest()}
if a.distribution_branch:data['apkUrl']=f'https://raw.githubusercontent.com/bryanteta/-crm-ventas-celulares/lunivo-updates/{a.tag}/{a.apk.name}'
a.out.write_text(json.dumps(data,indent=2)+'\n')
