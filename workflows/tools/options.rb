#!/usr/bin/env ruby

require 'fileutils'
require 'optparse'
require 'pathname'
require 'tempfile'
require 'yaml'

command = ARGV.shift
settings = {}
OptionParser.new do |parser|
  parser.on('--work-root PATH', '本轮工作根目录的绝对路径') { |value| settings[:work_root] = value }
end.parse!(ARGV)

abort '用法: ruby options.rb set|get --work-root /absolute/path 选项名 [值]' unless %w[set get].include?(command)
abort '请提供绝对工作根目录' unless settings[:work_root] && Pathname.new(settings[:work_root]).absolute?

name = ARGV.shift
abort '请提供选项名' if name.nil? || name.empty?

schema_path = File.expand_path('../流程.yaml', __dir__)
schema = YAML.safe_load(File.read(schema_path)) || {}
definition = (schema['options'] || {})[name]
abort "未在流程.yaml中声明选项: #{name}" unless definition.is_a?(Hash)

root = settings[:work_root]
path = File.join(root, 'options.yaml')

if command == 'get'
  abort 'options.yaml尚未创建' unless File.file?(path)
  options = YAML.safe_load(File.read(path)) || {}
  abort 'options.yaml必须是键值映射' unless options.is_a?(Hash)
  abort "选项尚未设置: #{name}" unless options.key?(name)
  puts "#{name}: #{options[name].inspect}"
  exit 0
end

raw = ARGV.shift
abort '请提供选项值' if raw.nil? || !ARGV.empty?

value = case definition['type']
        when 'boolean'
          abort '布尔选项只接受true或false' unless %w[true false].include?(raw)
          raw == 'true'
        when 'string'
          raw
        when 'integer'
          abort '整数选项格式无效' unless raw.match?(/\A-?\d+\z/)
          raw.to_i
        when 'enum'
          abort '选项值不在允许列表中' unless Array(definition['values']).include?(raw)
          raw
        else
          abort "不支持的选项类型: #{definition['type']}"
        end

FileUtils.mkdir_p(root)
File.open(File.join(root, '.options.yaml.lock'), File::RDWR | File::CREAT, 0600) do |lock|
  lock.flock(File::LOCK_EX)
  options = File.file?(path) ? YAML.safe_load(File.read(path)) : {}
  options ||= {}
  abort 'options.yaml必须是键值映射' unless options.is_a?(Hash)
  options[name] = value

  Tempfile.create(['.options-', '.yaml'], root) do |temp|
    temp.write(YAML.dump(options))
    temp.flush
    temp.fsync
    File.rename(temp.path, path)
  end
end

puts "#{name}: #{value.inspect}"
