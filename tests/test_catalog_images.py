import importlib.util
import pathlib
import unittest
spec = importlib.util.spec_from_file_location('discovery', pathlib.Path(__file__).resolve().parent.parent / 'scripts/discover-catalog-images.py')
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)

class ExactImageTests(unittest.TestCase):
    def test_apple_exact_selector_and_original_url(self):
        css = '.image-compare-iphone-13-pink{background-image:url(/v/iphone/compare/an/images/pink_large_2x.jpg)}.image-compare-iphone-13-pro-black{background-image:url(/pro_large_2x.jpg)}'
        candidates = d.apple_candidates(css, 'https://www.apple.com/style.css')
        result = d.resolve({'model':'iPhone 13','color':'Rosado'}, candidates, {}, {})
        self.assertEqual(result['sourceImage'], 'https://www.apple.com/v/iphone/compare/an/images/pink_large_2x.jpg')
        self.assertIsNone(d.resolve({'model':'iPhone 13 Pro','color':'Rosado'}, candidates, {}, {}))
        self.assertIsNone(d.resolve({'model':'iPhone 13','color':'Color por confirmar'}, candidates, {}, {}))
    def test_no_guessing_ambiguous_finishes_or_overwriting_reviewed_color(self):
        apple = {('iPhone 13','blue'):{}, ('iPhone 13','deepblue'):{}}
        self.assertIsNone(d.resolve({'model':'iPhone 13','color':'Azul'}, apple, {}, {}))
        self.assertIsNotNone(d.resolve({'model':'iPhone 13','color':'Azul'}, apple, {}, {'iPhone 13|Azul':{'officialColor':'blue'}}))
    def test_samsung_uses_color_chip_and_model_metadata_not_random_gallery(self):
        item={'fmyChipList':[{'fmyChipType':'COLOR','fmyChipName':'Sky Blue'}], 'largeUrl':'//images.samsung.com/skyblue', 'originPdpUrl':'/uk/galaxy-s26-ultra-sky-blue/', 'modelCode':'SM-test'}
        data={'response':{'resultData':{'productList':[{'fmyMarketingName':'Galaxy S26 Ultra', 'modelList':[item]}]}}}
        result=d.samsung_candidates(data)
        self.assertEqual(result['Samsung S26 Ultra','Celeste']['sourceImage'],'https://images.samsung.com/skyblue?$624_624_PNG$')
        self.assertNotIn(('Samsung S26','Celeste'),result)
        item['largeUrl']='//untrusted.example/wrong';self.assertEqual(d.samsung_candidates(data),{})
        item['largeUrl']='//images.samsung.com/a';item['fmyChipList'][0]['fmyChipName']='Unknown';self.assertEqual(d.samsung_candidates(data),{})
    def test_gallery_requires_the_same_sku_and_color_and_skips_group_views(self):
        item={'fmyChipList':[{'fmyChipType':'COLOR','fmyChipName':'Sky Blue'}], 'largeUrl':'//images.samsung.com/main', 'originPdpUrl':'/uk/s26/', 'modelCode':'SM-123BLUE',
              'galleryImage':['//images.samsung.com/sm-123blue-back','//images.samsung.com/sm-123black-front','//images.samsung.com/sm-123blue-group','//images.samsung.com/sm-123blue-front'],
              'galleryImageAlt':['Galaxy S26 Ultra DeviceBackL30 Sky Blue','Galaxy S26 Ultra DeviceFront Black','Galaxy S26 Ultra AllColors Sky Blue','Galaxy S26 Ultra DeviceFront Sky Blue']}
        data={'response':{'resultData':{'productList':[{'fmyMarketingName':'Galaxy S26 Ultra','modelList':[item]}]}}}
        views=d.samsung_candidates(data)['Samsung S26 Ultra','Celeste']['gallerySources']
        self.assertEqual([v['label'] for v in views],['Parte posterior','Frente'])
        self.assertTrue(all('sm-123blue' in v['sourceImage'] for v in views))
    def test_apple_store_matches_exact_model_and_finish_excluding_boxes_and_color_groups(self):
        spec=importlib.util.spec_from_file_location('g', pathlib.Path(__file__).resolve().parent.parent / 'scripts/fetch-catalog-galleries.py')
        g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
        prefix='https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/'
        page=' '.join(prefix+x for x in ['refurb-iphone-15-pro-bluetitanium-202412?wid=1000','refurb-iphone-15-pro-bluetitanium-202412_AV2?wid=1000','refurb-iphone-15-pro-bluetitanium-202412_AV1_GEO_US?wid=1000','refurb-iphone-og-202408?wid=1000'])
        result=g.apple_store_candidates(page,'https://www.apple.com/shop/refurbished/iphone')
        self.assertEqual(list(result),[('iPhone 15 Pro','bluetitanium')])
        self.assertNotIn('AV',result['iPhone 15 Pro','bluetitanium']['sourceImage'])
        self.assertIsNone(g.legacy_apple_candidate({'model':'iPhone 18 Pro','officialColor':'black'}))
        self.assertIsNone(g.legacy_apple_candidate({'model':'iPhone 13','officialColor':'Color por confirmar'}))
    def test_retailer_gallery_requires_exact_model_color_and_safe_filename(self):
        spec=importlib.util.spec_from_file_location('e',pathlib.Path(__file__).resolve().parent.parent/'scripts/expand-device-galleries.py');e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
        import json
        data={'productPageData':{'selectedProduct':{'modelName':'iPhone 13'},'modelAvailabilityData':{'colors':[{'color':'Midnight','primaryImage':{'imageLink':'swappie-iphone-13-midnight.png'},'secondaryImage':{'imageLink':'swappie-iphone-13-blue-back.png'},'tertiaryImage':{'imageLink':'https://untrusted.example/front.png'}}]}}}
        page='<script>window.__INITIAL__DATA__ = '+json.dumps(data)+';</script>'
        records=e.swappie_records(page,'iPhone 13','https://swappie.com/us/iphone/iphone-13/')
        self.assertEqual(len(records['midnight']),0)  # Paired primary image is not an extra perspective.
        self.assertEqual(e.swappie_records(page,'iPhone 13 Pro','https://swappie.com/'),{})
        self.assertEqual(e.refurbed_photos('<div data-instance-id="2"></div>',{'sku':'1','url':'https://www.refurbed.ie/p/test/'}),[])
    def test_press_images_require_public_released_exact_color_product_files(self):
        spec=importlib.util.spec_from_file_location('p',pathlib.Path(__file__).resolve().parent.parent/'scripts/press-device-galleries.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
        root={'isPublic':True,'embargoTime':'2022-01-01T00:00:00','imageUrl':'https://api.samsungmobilepress.com/api/v1/file/public'}
        rows=[{'item':{**root,'filename':'001_galaxys22ultra_device_front_burgundy.jpg'}},{'item':{**root,'filename':'002_galaxys22ultra_device_back_phantomblack.jpg'}},{'item':{**root,'filename':'003_galaxys22ultra_pen_front_burgundy.jpg'}},{'item':{**root,'isPublic':False,'filename':'004_galaxys22ultra_device_back_burgundy.jpg'}},{'item':{**root,'embargoTime':'2099-01-01T00:00:00','filename':'005_galaxys22ultra_l_side_burgundy.jpg'}}]
        self.assertEqual([v['label'] for v in p.matching_views(rows,'Samsung S22 Ultra','Burgundy')],['Frente'])
        self.assertEqual(p.matching_views(rows,'Samsung Z Flip 4','Bespoke White/White (Silver frame)'),[])
if __name__ == '__main__':unittest.main()
