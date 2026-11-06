Pod::Spec.new do |s|
  s.name = 'SoftekOverlayCapture'
  s.version = '0.1.0'
  s.summary = 'Local-only Softek owning-window capture experiment'
  s.description = s.summary
  s.license = { :type => 'UNLICENSED' }
  s.author = 'Softek POC'
  s.homepage = 'https://demo.bawebtech.com'
  s.platforms = { :ios => '16.4' }
  s.source = { :git => 'https://github.com/cnm4us/softek.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.swift_version = '5.0'
end
