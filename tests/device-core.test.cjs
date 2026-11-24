const {test}=require('node:test'),a=require('node:assert/strict'),d=require('../device-core.js');
test('equivalent provider spellings share a model but different editions remain distinct',()=>{
 for(const raw of ['GALAXY S24 ULTRA 512GB','Samsung Galaxy S24 Ultra','S24 Ultra','Samsung S24 Ultra'])a.equal(d.model(raw),'Samsung S24 Ultra');
 for(const raw of ['Apple iPhone 11 Pro Max','iPhone11ProMax 64GB','IPHONE 11 PRO MAX'])a.equal(d.model(raw),'iPhone 11 Pro Max');
 a.notEqual(d.modelKey('iPhone 11'),d.modelKey('iPhone 11 Pro'));a.notEqual(d.modelKey('S24'),d.modelKey('S24 FE'));
 a.equal(d.model('Galaxy Z Flip4'),'Samsung Z Flip 4');
});
test('numeric phone order keeps storage and colors together without changing source data',()=>{
 const input=[{model:'iPhone 13'},{model:'iPhone 11',capacity:'1 TB'},{model:'iPhone11',capacity:'128GB'},{model:'iPhone 11 Pro'},{model:'iPhone 11',capacity:'64GB',color:'Negro'},{model:'iPhone 11',capacity:'64 GB',color:'Blanco'}],copy=structuredClone(input);
 const sorted=[...input].sort(d.compare);a.deepEqual(sorted.map(x=>[d.model(x),d.capacity(x),d.color(x)]),[['iPhone 11','64 GB','Blanco'],['iPhone 11','64 GB','Negro'],['iPhone 11','128 GB',''],['iPhone 11','1 TB',''],['iPhone 11 Pro','',''],['iPhone 13','','']]);a.deepEqual(input,copy);
});
test('wearables cannot masquerade as Samsung or Apple phone families',()=>{
 for(const model of ['Apple Watch SE 3 44MM','GALAXY WATCH 7','Samsung Watch','Smartwatch','Reloj Samsung','Mi Band 8']){a.equal(d.isWearable(model),true);a.equal(d.family({model}),'');}
 for(const model of ['iPhone 11','Galaxy S24','Samsung Z Fold 6'])a.equal(d.isWearable(model),false);
});
test('16e, 17e, Air and Edge are their own models so a cheaper edition never looks like the base phone',()=>{
 for(const raw of ['iPhone 16e','IPHONE 16E 128GB','Apple iPhone 16e · 256GB'])a.equal(d.model(raw),'iPhone 16e');
 a.equal(d.model('iPhone 17e'),'iPhone 17e');a.equal(d.model('iPhone Air 256GB'),'iPhone 17 Air');a.equal(d.modelKey('iPhone Air'),d.modelKey('iPhone 17 Air'));a.equal(d.model('iPhone XS Max 64GB'),'iPhone XS Max');a.equal(d.model('iPhoneXR 64GB'),'iPhone XR');
 a.notEqual(d.modelKey('iPhone 16e'),d.modelKey('iPhone 16'));a.notEqual(d.modelKey('iPhone 17e'),d.modelKey('iPhone 17'));a.notEqual(d.modelKey('iPhone XS Max'),d.modelKey('iPhone XS'));
 a.equal(d.model('iPhone 16 esim 128GB'),'iPhone 16','an eSIM note is not the 16e');
 a.equal(d.model('Samsung Galaxy S25 Edge'),'Samsung S25 Edge');a.notEqual(d.modelKey('Galaxy S25 Edge'),d.modelKey('Galaxy S25'));
 for(const raw of ['S23+','Galaxy S23 +','Samsung Galaxy S23 Plus'])a.equal(d.model(raw),'Samsung S23 Plus');
 a.equal(d.family({model:'iPhone 16e'}),'iphone');a.equal(d.family({model:'Galaxy S25 Edge'}),'samsung');
});
